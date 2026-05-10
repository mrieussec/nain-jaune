# Nain Jaune Online

Une version en ligne et multijoueur du jeu de société français classique "Nain Jaune" (Yellow Dwarf).

Le jeu est déployé et jouable à l'adresse https://nain-jaune-online.web.app

Le Font-end est déployé sur Firebase et le Back-end sur Render

## 🎮 À propos du jeu

Le Nain Jaune est un jeu de cartes traditionnel français pour 2-6 joueurs. Les joueurs doivent se débarrasser de toutes leurs cartes en les plaçant sur les piles de la table ou sur les fondations. Le premier joueur à vider sa main gagne la manche.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 16+ 
- npm ou yarn

### Installation

1. **Installer les dépendances du serveur**
```bash
cd server
npm install
```

2. **Installer les dépendances du client**
```bash
cd client
npm install
```

### Lancer l'application

**Terminal 1 - Serveur backend:**
```bash
cd server
npm run dev
```
Le serveur démarre sur `http://localhost:5000`

**Terminal 2 - Frontend React:**
```bash
cd client
npm start
```
L'application s'ouvre sur `http://localhost:3000`

## 📁 Structure du projet

```
NainJaune/
├── server/
│   ├── src/
│   │   ├── server.js           # Point d'entrée du serveur
│   │   ├── game/
│   │   │   ├── GameManager.js  # Gestion des salles
│   │   │   ├── Room.js         # Logique d'une partie
│   │   │   ├── Player.js       # Données des joueurs
│   │   │   └── Deck.js         # Gestion du deck de cartes
│   │   └── handlers/
│   │       ├── gameHandlers.js # Événements du jeu
│   │       └── chatHandlers.js # Gestion du chat
│   ├── package.json
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── App.js              # Composant principal
│   │   ├── pages/
│   │   │   ├── Home.js         # Écran d'accueil
│   │   │   └── GameRoom.js     # Interface de jeu
│   │   ├── components/
│   │   │   ├── Card.js         # Composant carte
│   │   │   ├── PlayerHand.js   # Main du joueur
│   │   │   └── Chat.js         # Chat en temps réel
│   │   ├── services/
│   │   │   └── socketService.js # Service Socket.io
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🎯 Fonctionnalités

- ✅ Création et gestion de salles multijoueur
- ✅ Communication en temps réel avec Socket.io
- ✅ Affichage des cartes avec interface intuitive
- ✅ Chat intégré pour communiquer avec les autres joueurs
- ✅ Support de 2-6 joueurs par partie
- ✅ Gestion complète de la logique du jeu
- ✅ Interface responsive et moderne

## 🔧 Technologie utilisée

### Backend
- **Express.js** - Framework web
- **Socket.io** - Communication en temps réel
- **Node.js** - Runtime JavaScript

### Frontend
- **React** - Bibliothèque UI
- **Socket.io Client** - Client WebSocket
- **CSS3** - Styling moderne

## 📝 Règles du jeu (implémentation basique)

1. Les joueurs reçoivent un nombre égal de cartes
2. Le jeu se joue en posant des cartes:
   - Sur les **piles** en respectant la séquence (suite de même couleur)
   - Sur les **fondations** avec les cartes correctes
3. Le premier joueur à vider sa main gagne

## 🛣️ Roadmap future

- [ ] Système de scores et statistiques
- [ ] Persistance des données (base de données)
- [ ] Authentification utilisateur
- [ ] Historique des parties
- [ ] Système de classement (Elo/Ranking)
- [ ] Notifications push
- [ ] Mode spectateur
- [ ] Avatars et personnalisation
- [ ] Implémentation complète des règles avancées du Nain Jaune
- [ ] Tests unitaires et d'intégration
- [ ] Déploiement en production

## 🤝 Contribution

Les contributions sont bienvenues! N'hésitez pas à soumettre des pull requests ou des issues.

## 📄 Licence

MIT

---

**Prêt à jouer?** Lancez les serveurs et amusez-vous! 🎰
