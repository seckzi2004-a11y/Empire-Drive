# Empire Drive – Site de location de voitures

Site statique (HTML, CSS, JavaScript), sans installation ni dépendance.

## Ouvrir dans VS Code

1. Décompresse le dossier, puis `Fichier > Ouvrir le dossier`.
2. Installe l'extension **Live Server**, clic droit sur `index.html` > **Open with Live Server**.

## Structure

```
index.html          Site public
admin.html          Espace administrateur (voitures, prix, réservations)
css/style.css       Couleurs (variables en haut), mise en page du site
css/admin.css       Style de l'espace administrateur
js/main.js          Flotte, filtres, estimation, voitures animées, envoi WhatsApp
js/admin.js         Logique de l'espace administrateur
js/firebase-config.js   Tes clés Firebase à renseigner
firestore.rules     Règles de sécurité de la base
firebase.json       Configuration du déploiement
```

## À modifier en premier

- `js/main.js` : `WHATSAPP_NUMBER`. La liste `DEFAULT_FLEET` ne sert que de démonstration tant que Firebase n'est pas configuré.
- `index.html` : nom de l'agence, téléphone, adresse, horaires, conditions (textes entre crochets).
- `css/style.css` : couleurs dans `:root`.
- Photos : mets-les dans `images/` et indique le chemin dans `image` (ex. `images/corolla.png`). Pour l'animation du haut de page, utilise des PNG détourés (fond transparent) et ajoute-les dans `SCENE_CARS`.

## Espace administrateur (voitures, prix, réservations)

La page `admin.html` permet d'ajouter, modifier, supprimer des voitures, de changer les prix, de mettre une voiture indisponible et de suivre les demandes de réservation. Elle utilise Firebase (gratuit pour ce volume).

1. Va sur https://console.firebase.google.com et crée un projet.
2. **Build > Firestore Database** : crée la base (mode production).
3. **Build > Authentication > Sign-in method** : active « Email/mot de passe », puis onglet **Users** > **Add user** : crée le compte de ton amie avec son email (mot de passe provisoire quelconque). Ajoute aussi le tien si tu veux garder l'accès.
   Elle choisit ensuite son propre mot de passe depuis `admin.html` avec « Mot de passe oublié ou première connexion ? » : elle reçoit un email avec un lien.
4. **Paramètres du projet > Vos applications > Web (</>)** : enregistre une application et copie la configuration dans `js/firebase-config.js`.
5. Ouvre `firestore.rules`, remplace les deux emails d'exemple par celui de ton amie et le tien (retire le tien si tu ne veux pas d'accès), puis colle le contenu dans **Firestore > Règles** et publie (ou lance `firebase deploy --only firestore:rules`).
6. Ton amie ouvre `admin.html`, se connecte et ajoute ses voitures et ses tarifs. Elles apparaissent aussitôt sur le site.

Quand Firebase est configuré, la flotte de démonstration disparaît et seules les voitures de l'admin s'affichent. Chaque demande envoyée depuis le formulaire s'ouvre dans WhatsApp et s'enregistre aussi dans l'onglet **Réservations**.

Les photos sont réduites automatiquement et stockées dans la base (pas besoin de Firebase Storage). Utilise de préférence des PNG sans fond.

## Mettre en ligne (gratuit)

Le site est statique, donc il se déploie tel quel sur Netlify (glisser-déposer le dossier), Firebase Hosting (`firebase login` puis `firebase deploy` : `firebase.json` est déjà prêt), Vercel ou GitHub Pages.
