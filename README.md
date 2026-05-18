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

### Mode spectateur
- Bouton "👁 Regarder" sur chaque salle depuis le lobby
- Vue en temps réel du plateau, des joueurs et de la séquence en cours
- Aucune action de jeu possible (mains et boutons masqués)
- Liste des spectateurs visible par tous les participants
- Compteur de spectateurs affiché dans le lobby
- Chat accessible aux spectateurs

### Scores & statistiques persistantes
- Classement global accessible depuis l'écran d'accueil
- Statistiques par joueur : victoires, parties jouées, taux de victoire, meilleur gain, cases spéciales collectées, brocantages, éliminations
- Fiche détaillée par joueur avec historique des cases spéciales
- API REST : `GET /api/stats` · `GET /api/stats/:name`
- Persistance JSON côté serveur

### Tests automatisés
- **133 tests** (Vitest) couvrant toute la logique serveur
- Deck, Player, GameManager, Room (séquences, brocantage, spectateurs, fin de manche…), StatsManager

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

### Lancer les tests

```bash
cd server && npm test
```

---

## 📁 Structure du projet

```
NainJaune/
├── server/
│   ├── src/
│   │   ├── server.js               # Point d'entrée, Socket.io, CORS
│   │   ├── game/
│   │   │   ├── GameManager.js      # Gestion des salles et spectateurs
│   │   │   ├── Room.js             # Logique complète d'une partie
│   │   │   ├── Player.js           # Données des joueurs
│   │   │   └── Deck.js             # Gestion du deck
│   │   │   └── __tests__/          # Tests unitaires (Vitest)
│   │   ├── handlers/
│   │   │   ├── gameHandlers.js     # Événements du jeu
│   │   │   └── chatHandlers.js     # Chat
│   │   └── stats/
│   │       ├── StatsManager.js     # Persistance des statistiques
│   │       └── __tests__/          # Tests StatsManager
│   ├── data/
│   │   └── stats.json              # Données de stats (ignoré par git)
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/
│   │   │   ├── Home.js             # Écran d'accueil / lobby
│   │   │   ├── GameRoom.js         # Interface de jeu principale
│   │   │   └── Stats.js            # Page classement & statistiques
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
| Tests | Vitest |
| Déploiement frontend | Firebase Hosting |
| Déploiement backend | Render |

---

## 🛣️ Roadmap

- [x] Système de scores et statistiques persistantes
- [x] Tests unitaires et d'intégration
- [x] Mode spectateur
- [ ] Authentification utilisateur
- [ ] Historique des parties

---

## 📄 Licence

MIT
