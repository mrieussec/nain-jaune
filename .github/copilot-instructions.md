# Nain Jaune Online - Instructions VS Code

Ce fichier contient les instructions spécifiques pour développer et maintenir ce projet.

## 🚀 Installation initiale

1. Installer les dépendances serveur et client:
```bash
cd server && npm install && cd ..
cd client && npm install && cd ..
```

2. Créer les fichiers .env:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## 🎮 Lancer le projet en développement

Utilisez les tâches VS Code:
- **Start Server**: Lance le serveur backend avec nodemon
- **Start Client**: Lance l'application React
- **Start Both**: Lance les deux services simultanément

Ou manuellement:
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend  
cd client && npm start
```

## 📦 Architecture

- **Backend**: Express.js + Socket.io (port 5000)
- **Frontend**: React (port 3000)
- **Communication**: WebSockets en temps réel

## 🔑 Points clés du code

### Logique du jeu
- [GameManager.js](server/src/game/GameManager.js) - Gestion des salles
- [Room.js](server/src/game/Room.js) - Logique de partie
- [Deck.js](server/src/game/Deck.js) - Gestion des cartes

### Interface utilisateur
- [Home.js](client/src/pages/Home.js) - Écran d'accueil
- [GameRoom.js](client/src/pages/GameRoom.js) - Interface de jeu

### Communication temps réel
- [socketService.js](client/src/services/socketService.js) - Client Socket.io
- [gameHandlers.js](server/src/handlers/gameHandlers.js) - Événements serveur

## ✅ Prochaines étapes

1. Tester le jeu en mode multijoueur
2. Peaufiner la logique du jeu
3. Ajouter des tests
4. Préparer le déploiement

## 🐛 Dépannage

**Le serveur ne démarre pas**: Vérifier le port 5000 n'est pas utilisé
**Le client ne se connecte pas**: Vérifier que le serveur est actif sur localhost:5000
**Socket.io ne fonctionne pas**: Vérifier les CORS dans server.js

---

Bon développement! 🎰
