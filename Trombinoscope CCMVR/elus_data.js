const ELUS_DATA = [
    {
        "id": 1,
        "nom": "DUPONT",
        "prenom": "Julie",
        "commune": "Sainte-Agathe",
        "role": "Présidente",
        "attributions": "Économie - RH - Communication",
        "photo": "Photos_Elus/photo_1.jpg",
        "importance": 1
    },
    {
        "id": 2,
        "nom": "MARTIN",
        "prenom": "Thomas",
        "commune": "Saint-Julien-sur-Loire",
        "role": "1ère Vice-Présidente",
        "attributions": "Finances - Marchés Publics",
        "photo": "Photos_Elus/photo_2.jpg",
        "importance": 2
    },
    {
        "id": 3,
        "nom": "LEROY",
        "prenom": "Sophie",
        "commune": "Mireval-sur-Loire",
        "role": "2ème Vice-Président",
        "attributions": "Tourisme - Gémapi",
        "photo": "Photos_Elus/photo_3.jpg",
        "importance": 2
    },
    {
        "id": 4,
        "nom": "BERNARD",
        "prenom": "Pierre",
        "commune": "Valprivas",
        "role": "3ème Vice-Présidente",
        "attributions": "Enfance-Jeunesse - Solidarité territoriale",
        "photo": "Photos_Elus/photo_4.jpg",
        "importance": 2
    },
    {
        "id": 5,
        "nom": "PETIT",
        "prenom": "Marie",
        "commune": "Val-Saint-Martin",
        "role": "4ème Vice-Président",
        "attributions": "Eau - Assainissement - SPANC",
        "photo": "Photos_Elus/photo_5.jpg",
        "importance": 2
    },
    {
        "id": 6,
        "nom": "ROUX",
        "prenom": "Nicolas",
        "commune": "Saint-Pierre-des-Monts",
        "role": "5ème Vice-Président",
        "attributions": "Environnement - Mobilité",
        "photo": "Photos_Elus/photo_6.jpg",
        "importance": 2
    },
    {
        "id": 7,
        "nom": "SIMON",
        "prenom": "Catherine",
        "commune": "Saint-Paul-en-Forez",
        "role": "6ème Vice-Président",
        "attributions": "Collecte des Ordures Ménagères",
        "photo": "Photos_Elus/photo_7.jpg",
        "importance": 2
    },
    {
        "id": 8,
        "nom": "LAURENT",
        "prenom": "Jean",
        "commune": "La Chapelle-Saint-Jean",
        "role": "7ème Vice-Président",
        "attributions": "Équipements - Mutualisation",
        "photo": "Photos_Elus/photo_8.jpg",
        "importance": 2
    },
    {
        "id": 9,
        "nom": "LEFEBVRE",
        "prenom": "Audrey",
        "commune": "Les Tilleuls",
        "role": "8ème Vice-Président",
        "attributions": "Culture - Sport",
        "photo": "Photos_Elus/photo_9.jpg",
        "importance": 2
    },
    {
        "id": 10,
        "nom": "MICHEL",
        "prenom": "Michel",
        "commune": "Chalencon-les-Pins",
        "role": "Conseiller Délégué",
        "attributions": "Mutualisation - Solidarité communautaire",
        "photo": "Photos_Elus/photo_10.jpg",
        "importance": 3
    },
    {
        "id": 11,
        "nom": "GARCIA",
        "prenom": "Nathalie",
        "commune": "Mont-Tiranges",
        "role": "Conseiller Délégué",
        "attributions": "Sécurité",
        "photo": "Photos_Elus/photo_11.jpg",
        "importance": 3
    },
    {
        "id": 12,
        "nom": "DAVID",
        "prenom": "Francois",
        "commune": "Saint-Andre-les-Châteaux",
        "role": "Conseiller Délégué",
        "attributions": "Mobilité",
        "photo": "Photos_Elus/photo_12.jpg",
        "importance": 3
    },
    {
        "id": 13,
        "nom": "BERTRAND",
        "prenom": "Isabelle",
        "commune": "Solignac-le-Château",
        "role": "Conseillère Déléguée",
        "attributions": "Action sociale - Solidarité territoriale",
        "photo": "Photos_Elus/photo_13.jpg",
        "importance": 3
    },
    {
        "id": 14,
        "nom": "ROUBY",
        "prenom": "Lucas",
        "commune": "Boisset-le-Vert",
        "role": "Conseiller Délégué",
        "attributions": "Prévention de la délinquance - Conventions associations",
        "photo": "Photos_Elus/photo_14.jpg",
        "importance": 3
    },
    {
        "id": 15,
        "nom": "BARBIER",
        "prenom": "Sylvie",
        "commune": "Saint-Paul-en-Forez",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_15.jpg",
        "importance": 4
    },
    {
        "id": 16,
        "nom": "VINCENT",
        "prenom": "Guillaume",
        "commune": "Mireval-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_16.jpg",
        "importance": 4
    },
    {
        "id": 17,
        "nom": "MOREAU",
        "prenom": "Valerie",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_17.jpg",
        "importance": 4
    },
    {
        "id": 18,
        "nom": "FOURNIER",
        "prenom": "Christophe",
        "commune": "Mireval-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_18.jpg",
        "importance": 4
    },
    {
        "id": 19,
        "nom": "GIRARD",
        "prenom": "Sandrine",
        "commune": "Sainte-Agathe",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_19.jpg",
        "importance": 4
    },
    {
        "id": 20,
        "nom": "BONNET",
        "prenom": "Julien",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_20.jpg",
        "importance": 4
    },
    {
        "id": 21,
        "nom": "DUBOIS",
        "prenom": "Cecile",
        "commune": "Sainte-Agathe",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_21.jpg",
        "importance": 4
    },
    {
        "id": 22,
        "nom": "MOREL",
        "prenom": "Antoine",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_22.jpg",
        "importance": 4
    },
    {
        "id": 23,
        "nom": "GUERIN",
        "prenom": "Laurence",
        "commune": "Sainte-Agathe",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_23.jpg",
        "importance": 4
    },
    {
        "id": 24,
        "nom": "ANDRE",
        "prenom": "Sebastien",
        "commune": "Mireval-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_24.jpg",
        "importance": 4
    },
    {
        "id": 25,
        "nom": "RICHARD",
        "prenom": "Elisabeth",
        "commune": "Mireval-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_25.jpg",
        "importance": 4
    },
    {
        "id": 26,
        "nom": "ROCHETTE",
        "prenom": "Mathieu",
        "commune": "Mireval-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_26.jpg",
        "importance": 4
    },
    {
        "id": 27,
        "nom": "FAURE",
        "prenom": "Francoise",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_27.jpg",
        "importance": 4
    },
    {
        "id": 28,
        "nom": "BLANCHARD",
        "prenom": "Alexandre",
        "commune": "Saint-Paul-en-Forez",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_28.jpg",
        "importance": 4
    },
    {
        "id": 29,
        "nom": "BRUN",
        "prenom": "Patricia",
        "commune": "Sainte-Agathe",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_29.jpg",
        "importance": 4
    },
    {
        "id": 30,
        "nom": "GERARD",
        "prenom": "Stephane",
        "commune": "Sainte-Agathe",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_30.jpg",
        "importance": 4
    },
    {
        "id": 31,
        "nom": "MERCIER",
        "prenom": "Emilie",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_31.jpg",
        "importance": 4
    },
    {
        "id": 32,
        "nom": "MARIE",
        "prenom": "Jerome",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_32.jpg",
        "importance": 4
    },
    {
        "id": 33,
        "nom": "DUVAL",
        "prenom": "Monique",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_33.jpg",
        "importance": 4
    },
    {
        "id": 34,
        "nom": "SCHMITT",
        "prenom": "Olivier",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_34.jpg",
        "importance": 4
    },
    {
        "id": 35,
        "nom": "LEROUX",
        "prenom": "Chantal",
        "commune": "Saint-Pierre-des-Monts",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_35.jpg",
        "importance": 4
    },
    {
        "id": 36,
        "nom": "ROY",
        "prenom": "Laurent",
        "commune": "Saint-Pierre-des-Monts",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_36.jpg",
        "importance": 4
    },
    {
        "id": 37,
        "nom": "ROUSSEAU",
        "prenom": "Christine",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_37.jpg",
        "importance": 4
    },
    {
        "id": 38,
        "nom": "CLERC",
        "prenom": "Didier",
        "commune": "Sainte-Agathe",
        "role": "Conseiller Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_38.jpg",
        "importance": 4
    },
    {
        "id": 39,
        "nom": "BONNARD",
        "prenom": "Sarah",
        "commune": "Saint-Julien-sur-Loire",
        "role": "Conseillère Communautaire",
        "attributions": "",
        "photo": "Photos_Elus/photo_39.jpg",
        "importance": 4
    }
];