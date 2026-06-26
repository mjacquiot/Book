// --- THÈMES ET SUJETS (COMMISSIONS ET DOSSIERS) ---
window.promptCreateTheme = async () => {
  const title = prompt("Titre de la commission/thème :");
  if (!title) return;
  const desc = prompt("Description :");
  let encTitle = title;
  let encDesc = desc || '';
  let ivData = null;
  if (window.sessionCollectivityKey) {
      const eT = await window.CryptoManager.encryptDictionaryEntry({text: encTitle}, window.sessionCollectivityKey);
      const eD = await window.CryptoManager.encryptDictionaryEntry({text: encDesc}, window.sessionCollectivityKey);
      encTitle = eT.cipher;
      encDesc = eD.cipher;
      ivData = JSON.stringify({ title_iv: eT.iv, desc_iv: eD.iv });
  }
  await supabaseClient.from('themes').insert({ title: encTitle, description: encDesc, collectivite_id: state.user.collectivite_id, iv: ivData });
  logHistory(null, 'CREATION_THEME', `Thème créé : ${title}`);
  await syncFromSupabase();
  render();
};

window.promptCreateSubject = async (themeId) => {
  const title = prompt("Titre du nouveau dossier :");
  if (!title) return;
  const desc = prompt("Description :");
  const isConf = confirm("Ce dossier est-il confidentiel (invisible aux techniciens) ?");
  let encTitle = title;
  let encDesc = desc || '';
  let ivData = null;
  if (window.sessionCollectivityKey) {
      const eT = await window.CryptoManager.encryptDictionaryEntry({text: encTitle}, window.sessionCollectivityKey);
      const eD = await window.CryptoManager.encryptDictionaryEntry({text: encDesc}, window.sessionCollectivityKey);
      encTitle = eT.cipher;
      encDesc = eD.cipher;
      ivData = JSON.stringify({ title_iv: eT.iv, desc_iv: eD.iv });
  }
  await supabaseClient.from('subjects').insert({ theme_id: themeId, title: encTitle, description: encDesc, is_confidential: isConf, collectivite_id: state.user.collectivite_id, iv: ivData });
  logHistory(themeId, 'AJOUT_SUJET', `Sujet créé : ${title}`);
  await syncFromSupabase();
  render();
};

window.deleteSubject = async (e, sid) => {
  e.stopPropagation();
  if (confirm("Supprimer ce sujet définitivement ?")) {
    const s = state.subjects.find(x => x.id === sid);
    await supabaseClient.from('subjects').delete().eq('id', sid);
    logHistory(s.themeId, 'SUPPRESSION_SUJET', `Sujet détruit : ${s.title}`);
    await syncFromSupabase();
    render();
  }
}

// --- MESSAGERIE ---
window.sendMsg = async (type, targetId, inputId) => {
  const i = document.getElementById(inputId);
  const text = i.value;
  if (!text) return;
  await supabaseClient.from('messages').insert({ type, target_id: targetId, sender: state.user.username, text });
  i.value = '';
  await syncFromSupabase();
  render();
  setTimeout(() => {
    const c = document.getElementById('thread-chat-subj');
    if (c) c.scrollTop = c.scrollHeight;
  }, 50);
};

// --- VOTES ---
window.promptCreateVote = async (sid) => {
  const q = prompt("Question du vote (ex: Êtes-vous pour ce projet ?) :");
  if (!q) return;
  const rawOpts = prompt("Réponses possibles, séparées par une virgule (ex: Oui, Non, Peut-être) :");
  if (!rawOpts) return;
  const opts = rawOpts.split(',').map(o => o.trim()).filter(Boolean);
  if (opts.length < 2) return alert("Il faut au minimum 2 options.");

  const target = confirm("Ce vote est-il à destination des ÉLUS en interne ?\n(OK = Élus en interne, Annuler = Vote Public Citoyen)");

  const newVote = { target: target ? 'elu' : 'public', question: q, options: opts, counts: new Array(opts.length).fill(0), voters: [] };
  await supabaseClient.from('subjects').update({ vote: newVote }).eq('id', sid);
  await syncFromSupabase();
  render();
};

window.submitEluVote = async (subjectId, optionIndex) => {
  if (!state.user) return;
  if (confirm("Confirmer ce vote ? (définitif)")) {
    const s = state.subjects.find(x => x.id === subjectId);
    let updatedVote = JSON.parse(JSON.stringify(s.vote));
    if (!updatedVote.voters) updatedVote.voters = [];
    if (!updatedVote.counts) updatedVote.counts = new Array(updatedVote.options.length).fill(0);
    updatedVote.counts[optionIndex]++;
    updatedVote.voters.push(state.user.id);

    // Rendu Optimiste (immédiat)
    s.vote = updatedVote;
    render();

    const { error } = await supabaseClient.from('subjects').update({ vote: updatedVote }).eq('id', subjectId);
    if (error) {
       alert("Erreur de sauvegarde de votre vote : " + error.message);
    }
    await syncFromSupabase();
    render();
  }
};

window.submitPublicVote = async (subjectId, optionIndex) => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const expected = (a + b).toString();
  const answer = prompt(`Vérification Anti-Robot : Combien font ${a} + ${b} ?\nVeuillez taper le chiffre :`);
  if (answer && answer.trim() === expected) {
    const s = state.subjects.find(x => x.id === subjectId);
    let updatedVote = JSON.parse(JSON.stringify(s.vote));
    if (!updatedVote.counts) updatedVote.counts = new Array(updatedVote.options.length).fill(0);
    updatedVote.counts[optionIndex]++;

    const { error } = await supabaseClient.from('subjects').update({ vote: updatedVote }).eq('id', subjectId);
    if (error) {
      alert("Échec de l'enregistrement (seuls les membres authentifiés peuvent modifier les compteurs).");
    } else {
      state.publicVotedStatus[subjectId] = true;
      alert("Votre vote a bien été pris en compte. Merci de votre participation !");
    }
    await syncFromSupabase();
    render();
  } else {
    alert("Vérification échouée.");
  }
};
