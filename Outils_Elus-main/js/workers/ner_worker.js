import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuration : Autoriser le stockage local en cache pour ne pas le re-télécharger.
env.allowLocalModels = false; 

let currentPipelines = {
    expert: null,
    safeguard: null
};

// Stratégie Double Modèle
const MODEL_EXPERT = 'Xenova/camembert-ner'; // ~265 Mo
const MODEL_SAFEGUARD = 'Xenova/bert-base-multilingual-cased-ner-hrl'; // ~750 Mo

let modelDetailsStr = 'Modèles en cours de chargement...';

const loadModels = async (level) => {
    try {
        self.postMessage({ type: 'status', status: 'loading', level: level });
        
        let loadedBytes = 0;
        let totalBytes = 0;

        const progressCb = (info) => {
            if (info.status === 'progress' || info.status === 'done') {
                if (info.file && info.file.includes('model.onnx')) {
                    if (info.total) totalBytes += info.total;
                }
            }
            self.postMessage({ type: 'progress', level: level, data: info });
        };

        // Chargement parallèle des deux modèles
        const [pipeExpert, pipeSafeguard] = await Promise.all([
            pipeline('token-classification', MODEL_EXPERT, { progress_callback: progressCb, quantized: true }),
            pipeline('token-classification', MODEL_SAFEGUARD, { progress_callback: progressCb, quantized: true })
        ]);

        currentPipelines.expert = pipeExpert;
        currentPipelines.safeguard = pipeSafeguard;
        
        modelDetailsStr = `Double Moteur (CamemBERT + M-BERT) chargé (~1 Go)`;
        
        self.postMessage({ type: 'status', status: 'ready', level: level, modelName: modelDetailsStr });
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message || error.toString() });
    }
};

const mergeEntities = (wordPieceEntities) => {
    const aggregatedEntities = [];
    let currentEntity = null;
    
    for (const token of wordPieceEntities) {
        const isPerson = token.entity && (token.entity.endsWith('PER') || token.entity.endsWith('ORG') || token.entity.endsWith('LOC'));
        const isContinuation = token.entity && token.entity.startsWith('I-') || (token.word && token.word.startsWith('##'));
        
        if (isPerson && (!isContinuation || !currentEntity)) {
            if (currentEntity) aggregatedEntities.push(currentEntity);
            currentEntity = { 
                type: token.entity.split('-')[1], 
                word: token.word.replace('##', ''), 
                score: token.score,
                start: token.start,
                end: token.end
            };
        } else if (currentEntity && isContinuation) {
            currentEntity.word += token.word.replace('##', '');
            currentEntity.end = token.end;
            currentEntity.score = (currentEntity.score + token.score) / 2;
        } else {
            if (currentEntity) aggregatedEntities.push(currentEntity);
            currentEntity = null;
        }
    }
    if (currentEntity) aggregatedEntities.push(currentEntity);
    return aggregatedEntities;
};

// Fonction de Chunking pour éviter les Timeouts sur les très gros textes
const chunkText = (text, maxLength = 1500) => {
    const chunks = [];
    let currentPos = 0;
    while (currentPos < text.length) {
        let endPos = currentPos + maxLength;
        if (endPos >= text.length) {
            chunks.push(text.substring(currentPos));
            break;
        }
        // Chercher une fin de ligne ou une fin de phrase
        const nlPos = text.lastIndexOf('\n', endPos);
        const dotPos = text.lastIndexOf('.', endPos);
        
        let breakPos = Math.max(nlPos, dotPos);
        if (breakPos <= currentPos) breakPos = endPos; // fallback brutal
        else breakPos++; // inclure le saut ou le point
        
        chunks.push(text.substring(currentPos, breakPos));
        currentPos = breakPos;
    }
    return chunks;
};

self.addEventListener('message', async (event) => {
    const message = event.data;
    
    if (message.type === 'init') {
        await loadModels('expert_combined');
    }
    
    if (message.type === 'analyze') {
        if (!currentPipelines.expert || !currentPipelines.safeguard) {
            self.postMessage({ type: 'error', error: 'Pipelines is not loaded yet.' });
            return;
        }

        try {
            const chunks = chunkText(message.text, 1500);
            let finalEntities = [];
            let globalOffset = 0;

            for (const chunk of chunks) {
                // 1. Exécution des deux modèles sur le chunk
                const [outExpertRaw, outSafeguardRaw] = await Promise.all([
                    currentPipelines.expert(chunk, { ignore_labels: ['O'] }),
                    currentPipelines.safeguard(chunk, { ignore_labels: ['O'] })
                ]);
                
                const mergedExpert = mergeEntities(outExpertRaw);
                const mergedSafeguard = mergeEntities(outSafeguardRaw);
                
                // 2. Logique de fusion IA stricte
                // a) Score > 0.85 (Expert)
                // b) Score > 0.85 (Safeguard)
                // c) Intersection et Score > 0.70
                
                const validEntitiesMap = new Map(); // key = word, value = maxScore entity

                const addOrUpdate = (ent, confidenceRuleMatched) => {
                    if (!confidenceRuleMatched) return;
                    // Ne garder que des sous-chaines de mots de plus de 2 caractères
                    if (ent.word.length <= 2) return;
                    // On garde la majuscule originelle du texte (chunk) si on peut
                    const cleanWord = ent.word.trim();
                    if (!validEntitiesMap.has(cleanWord) || validEntitiesMap.get(cleanWord).score < ent.score) {
                        validEntitiesMap.set(cleanWord, { ...ent, word: cleanWord, start: ent.start + globalOffset, end: ent.end + globalOffset });
                    }
                };

                // Passage Expert
                for (const ex of mergedExpert) {
                    let hasIntersection = false;
                    for (const sf of mergedSafeguard) {
                        if (ex.word.includes(sf.word) || sf.word.includes(ex.word)) {
                            hasIntersection = true;
                            // Règle Intersection + > 0.70
                            addOrUpdate(ex, ex.score > 0.70 || sf.score > 0.70);
                            break;
                        }
                    }
                    if (!hasIntersection) {
                        // Règle Solitaire > 0.85
                        addOrUpdate(ex, ex.score > 0.85);
                    }
                }

                // Passage Safeguard (pour ce qu'on aurait loupé)
                for (const sf of mergedSafeguard) {
                    if (!validEntitiesMap.has(sf.word.trim())) {
                        addOrUpdate(sf, sf.score > 0.85);
                    }
                }

                // 3. Passe de sécurité grammaticale (Regex) pour Prénom NOM et mots entièrement majuscules
                // Regex 1: Prénom NOM (ex: Jean DUPONT ou Maxime JACQUIOT)
                const regexName = /\\b[A-ZÀ-Ÿ][a-zà-ÿ]+\\s+[A-ZÀ-Ÿ\\-]{2,}\\b/g;
                let match;
                while ((match = regexName.exec(chunk)) !== null) {
                    const word = match[0].trim();
                    if (!validEntitiesMap.has(word)) {
                        validEntitiesMap.set(word, {
                            type: 'PER_REGEX',
                            word: word,
                            score: 1.0,
                            start: match.index + globalOffset,
                            end: match.index + word.length + globalOffset
                        });
                    }
                }
                
                // Regex 2: Mots isolés en MAJUSCULES STRICTES (ex: JACQUIOT, SNCF)
                const regexUpper = /\\b[A-ZÀ-Ÿ\\-]{3,}\\b/g;
                while ((match = regexUpper.exec(chunk)) !== null) {
                    const word = match[0].trim();
                    let alreadyCovered = false;
                    for (const v of validEntitiesMap.values()) {
                        if (match.index + globalOffset >= v.start && match.index + globalOffset <= v.end) {
                            alreadyCovered = true; break;
                        }
                    }
                    if (!alreadyCovered && !validEntitiesMap.has(word)) {
                         validEntitiesMap.set(word, {
                            type: 'UPPER_REGEX',
                            word: word,
                            score: 1.0,
                            start: match.index + globalOffset,
                            end: match.index + word.length + globalOffset
                        });
                    }
                }

                finalEntities = finalEntities.concat(Array.from(validEntitiesMap.values()));
                globalOffset += chunk.length;
            }
            
            self.postMessage({ 
                type: 'result', 
                id: message.id, 
                entities: finalEntities 
            });
            
        } catch (error) {
           self.postMessage({ type: 'error', id: message.id, error: error.message || error.toString() });
        }
    }
});
