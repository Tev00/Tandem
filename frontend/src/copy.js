// ─────────────────────────────────────────────────────────────────────────────
// COPY — every user-visible string in one place.
// Edit here, then redeploy (./deploy/deploy.sh).
// ─────────────────────────────────────────────────────────────────────────────

export const COPY = {

  // ── App-wide ────────────────────────────────────────────────────────────────
  app: {
    name: 'Tandem',
    loading: 'Chargement…',
    not_found: 'Introuvable.',
    account_deactivated: 'Votre compte a été désactivé par l\'administrateur.',
  },

  // ── Bottom / top nav ────────────────────────────────────────────────────────
  nav: {
    home:        'Accueil',
    leaderboard: 'Classement',
    profile:     'Profil',
  },

  // ── Inscription (signup → pseudo → charte) ──────────────────────────────────
  inscription: {
    tag: 'Tandem',

    // Step 1 – auth
    headline_auth:    'Prêt à dialoguer?',
    subtitle_auth:    'Des dialogues au tour par tour, notés avec un score individuel et un score collectif.',
    placeholder_email:    'ton@email.fr',
    placeholder_password: 'mot de passe (8+ caractères)',
    btn_signup:  'Créer mon compte',
    btn_login:   'Se connecter',
    link_to_login:  'Déjà un compte ? Se connecter',
    link_to_signup: 'Pas de compte ? En créer un',

    // Step 2 – pseudo
    headline_pseudo:  'Choisis ton pseudonyme.',
    subtitle_pseudo:  'Visible par tes interlocuteurs. Ton e-mail, lui, reste privé.',
    placeholder_pseudo: 'ex. penseur_du_soir',
    btn_pseudo: 'Continuer',

    // Step 3 – charte
    headline_charte: 'La charte.',
    subtitle_charte: 'Trois principes simples comme règles du jeu.',
    btn_charte: 'J\'accepte la charte',
    charte_items: [
      ['Courtoisie',   'Restez courtois et respectueux avec les autres participants.'],
      ['Respect',     'Si vous le souhaitez, vous pouvez signaler un comportement inapproprié à tout moment en cliquant sur le drapeau en haut à droite.'],
      ['Confidentialité',   'Evitez de partager des informations personnelles.'],
    ],

    // Errors
    err_fields:        'E-mail valide et mot de passe d\'au moins 8 caractères.',
    err_signup_failed: 'Impossible de créer le compte (e-mail déjà utilisé ?).',
    err_login_failed:  'E-mail ou mot de passe incorrect.',
    err_pseudo_short:  'Au moins 3 caractères.',
    err_pseudo_taken:  'Ce pseudonyme est déjà pris.',
  },

  // ── Opinions ─────────────────────────────────────────────────────────────────
  opinions: {
    tag:           'tes opinions',
    headline:      'Où te situes-tu ?',
    scale_hint:    '1 = pas du tout · 3 = neutre · 5 = tout à fait.',
    btn_finish:    'Terminer',
    btn_remaining: (n) => `Encore ${n}`,
  },

  // ── Accueil ───────────────────────────────────────────────────────────────────
  accueil: {
    tag:              'accueil',
    headline_idle:    'Prêt à dialoguer?',
    headline_queue:   'En attente…',
    subtitle_idle:    'Rejoins la file d\'attente et on te proposera un dialogue dès qu\'un partenaire sera trouvé.',
    subtitle_queue:   'On te trouve un interlocuteur. Ça peut prendre quelques secondes.',
    section_dialogues: 'dialogues actifs',
    your_turn:        'à toi',
    their_turn:       'à eux',
    btn_find:         'Trouver un interlocuteur',
    btn_cancel:       'Annuler',
    err_join:         'Erreur en rejoignant la file.',
    err_leave:        'Erreur en quittant la file.',
  },

  // ── Dialogue ──────────────────────────────────────────────────────────────────
  dialogue: {
    loading:              'Chargement…',
    my_turn_status:       'à toi de répondre',
    their_turn_status:    (name) => `au tour de ${name}`,
    ended_status:         'terminé',
    placeholder_my_turn:  'Ta réponse…',
    placeholder_waiting:  (name) => `En attente de ${name}…`,
    send_hint:            'Ctrl+Entrée pour envoyer',
    btn_leave:            'Quitter ce dialogue',
    confirm_leave:        'Quitter ce dialogue ? Tu ne pourras pas revenir.',
    err_leave:            'Erreur en quittant le dialogue.',
    prompt_report:        'Que veux-tu signaler ?',
    report_sent:          'Signalement envoyé.',
  },

  // ── Bilan ─────────────────────────────────────────────────────────────────────
  bilan: {
    not_found:          'Dialogue introuvable.',
    still_active:       'Ce dialogue est encore en cours.',
    still_active_hint:  'La notation se fera automatiquement à la fin.',
    scoring_progress:   'Notation en cours…',
    scoring_hint:       'L\'IA analyse votre conversation. Ça prend quelques secondes.',
    btn_refresh:        'Actualiser',
    btn_back:           'Retour',
    tag:                'conversation terminée',
    section_individual: 'Tes critères (privé)',
    section_collective: 'Qualité collective de l\'échange',
    avg_label:          'Moyenne',
    total_label:        'Total',

    // Shown below the scores when the criterion is < 3. Fill in the advice texts manually.
    advice: {
      respect:        'N\'oublie pas de critiquer uniquement une idée, un raisonnement ou un système, à condition qu\'elle soit argumentée et ne réduise pas l\'interlocuteur à une intention, une identité ou une faute morale.',
      clarte:         'Tu peux rendres tes propositions plus compréhensibles et claires en explicitant ce que tu affirmes, et en précisant autant que possible le périmètre de tes propos, les termes importants, les critères de jugement. Pense à distinguer faits, valeurs, hypothèses et conséquences.',
      argumentation:  'Essaie de relier tes affirmations à des valeurs, des exemples et des conséquences attendues ou critères de jugement. Ici, l\'argumentation signifie justification raisonnée, pas performance de persuasion ni simple accumulation d\'affirmations.',
      nuance:         'Il est important de savoir reconnaître les limites des ses idées, les incertitudes et les conditions de validité, sans que cela t\'oblige pour autant à abandonner ta thèse. Une nuance est forte lorsquíelle est intégrée au raisonnement : elle précise, limite, corrige ou enrichit la position du participant.',
      ecoute_active:  'Pour améliorer ton score, prends le temps de comprendre, reformuler ou clarifier ce que l\'autre avance. Mais L\'écoute active n\'oblige pas à accepter l\'argument adverse, ni à répondre à tous les points.',
      fair_play:      'Pense à évaluer le plus honnêtement possible la position de ton interlocuteur. Essaie d\'en reconnaître les mérites lorsque c\'est pertinent, et critique ses faiblesses sans la caricaturer.',
    },
  },

  // ── Classement ────────────────────────────────────────────────────────────────
  classement: {
    tag:      'classement',
    headline: 'L\'agora',
    subtitle: 'hebdomadaire + all-time · arrive en Phase 3',
    empty:    'Le classement se remplira dès que la notation sera active et les premiers dialogues notés.',
  },

  // ── Profil ────────────────────────────────────────────────────────────────────
  profil: {
    role:              'interlocuteur · rang à venir',
    section_opinions:  'tes opinions',
    btn_edit_opinions: 'Modifier mes opinions',
    btn_logout:        'Se déconnecter',
    stances: ['', 'pas du tout', 'plutôt pas', 'neutre', 'plutôt', 'tout à fait'],
  },
}
