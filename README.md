# Nain Jaune Online

Une version en ligne et multijoueur du jeu de société français classique "Nain Jaune".

🎮 **Jouable ici :** https://nain-jaune-online.web.app

Frontend déployé sur **Firebase Hosting**, backend sur **Render**.

---

## 🃏 À propos du jeu

Le Nain Jaune est un jeu de cartes traditionnel français pour 2 à 6 joueurs. Les joueurs jouent des séquences de cartes en montant dans la même couleur, cherchant à vider leur main le plus vite possible tout en récoltant des jetons sur les cases spéciales du plateau.

---

## ✅ Fonctionnalités implémentées

### Jeu complet avec règles avancées
- 🟡 **Ouverture au 7♦** — le détenteur du 7♦ doit ouvrir la manche ; si le 7♦ est dans le talon, le joueur à gauche du donneur ouvre librement
- 🃏 **Donneur exclu** — avec 3 joueurs ou plus, le donneur distribue et paye les mises mais ne joue pas la manche
- ⚠️ **Pénalité de passe** — passer coûte 1 jeton qui s'accumule dans un pot remporté par le gagnant de la manche
- 🔒 **Brocantage** — quand une séquence est bloquée (carte dans le talon), n'importe quel joueur peut payer N−1 jetons pour débloquer ; si tous refusent, le dernier joueur rejoue librement
- ⭐ **Cases spéciales** — 10♦, V♣, D♠, R♥, 7♦ (Nain Jaune) avec accumulation si non remportées
- 🏆 **Fin de manche** — décompte des cartes restantes, double pénalité pour le 7♦, gain du pot

### Interface & multijoueur
- Salles multijoueur en temps réel (Socket.io)
- Chat intégré par salle
- Sons immersifs (synthèse audio Web Audio API — coins métalliques, chime de tour)
- Layout plein écran responsive, cartes jouables en surbrillance
- Modal "Règles" complet accessible en cours de partie
- Badge donneur, affichage du pot, indicateur de brocantage
- Reconnexion automatique avec restauration de la main

---

## 🚀 Démarrage local

### Prérequis
- Node.js 16+

### Installation

```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
```

### Lancer l'application

```bash
# Terminal 1 — serveur (port 5000)
cd server && npm run dev

# Terminal 2 — client (port 3000)
cd client && npm start
```

---

## 📁 Structure du projet

```
NainJaune/
├── server/
│   ├── src/
│   │   ├── server.js               # Point d'entrée, Socket.io, CORS
│   │   ├── game/
│   │   │   ├── GameManager.js      # Gestion des salles
│   │   │   ├── Room.js             # Logique complète d'une partie
│   │   │   ├── Player.js           # Données des joueurs
│   │   │   └── Deck.js             # Gestion du deck
│   │   └── handlers/
│   │       ├── gameHandlers.js     # Événements du jeu
│   │       └── chatHandlers.js     # Chat
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/
│   │   │   ├── Home.js             # Écran d'accueil / lobby
│   │   │   └── GameRoom.js         # Interface de jeu principale
│   │   ├── components/
│   │   │   ├── Card.js             # Composant carte
│   │   │   ├── PlayerHand.js       # Main du joueur local
│   │   │   └── Chat.js             # Chat temps réel
│   │   └── services/
│   │       └── socketService.js    # Service Socket.io
│   └── package.json
└── README.md
```

---

## 🔧 Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React, CSS3, Web Audio API |
| Backend | Node.js, Express |
| Temps réel | Socket.io |
| Déploiement frontend | Firebase Hosting |
| Déploiement backend | Render |

---

## 🛣️ Roadmap

- [ ] Système de scores et statistiques persistantes
- [ ] Authentification utilisateur
- [ ] Historique des parties
- [ ] Mode spectateur
- [ ] Tests unitaires et d'intégration

---

## 📄 Licence

MIT
