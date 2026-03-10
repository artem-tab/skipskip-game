diff --git a/src/gameLogic.js b/src/gameLogic.js
index 47683022142d7eee7056c5f9f5612abb10f73efa..826ac13dd627fab15e72fcddef280ddad23446ad 100644
--- a/src/gameLogic.js
+++ b/src/gameLogic.js
@@ -1,121 +1,117 @@
 // ============================================================
 // Skip-Bo Game Logic
 // ============================================================
 
 class SkipBoGame {
   constructor(stackSize = 20, mode = 'computer') {
     this.mode = mode; // 'computer' or 'online'
     this.stackSize = stackSize;
     this.players = [];
     this.buildPiles = [null, null, null, null]; // 4 build piles (1-12 sequence)
+    this.buildPileCards = [[], [], [], []];
+    this.completedBuildCards = [];
     this.drawPile = [];
     this.currentPlayerIndex = 0;
     this.gameOver = false;
     this.winner = null;
     this.status = 'waiting'; // waiting, playing, finished
   }
 
   // Create and shuffle a full Skip-Bo deck
   createDeck() {
     const deck = [];
     // 12 sets of cards 1-12 (162 cards) + 18 Skip-Bo wildcards = 180 cards
     for (let i = 0; i < 12; i++) {
       for (let num = 1; num <= 12; num++) {
         deck.push(num);
       }
     }
     for (let i = 0; i < 18; i++) {
       deck.push(0); // 0 = Skip-Bo wildcard
     }
     return this.shuffle(deck);
   }
 
   shuffle(array) {
     const arr = [...array];
     for (let i = arr.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [arr[i], arr[j]] = [arr[j], arr[i]];
     }
     return arr;
   }
 
   initGame(playerNames) {
     const deck = this.createDeck();
     let deckIndex = 0;
 
     this.players = playerNames.map((name, idx) => {
       const stockPile = deck.slice(deckIndex, deckIndex + this.stackSize);
       deckIndex += this.stackSize;
       return {
         id: idx,
         name,
         stockPile,       // Face-down stack, top is last element
         hand: [],        // 5 cards in hand
         discardPiles: [[], [], [], []], // 4 discard piles
         isComputer: idx === 1 && this.mode === 'computer'
       };
     });
 
     this.drawPile = deck.slice(deckIndex);
     this.buildPiles = [null, null, null, null];
+    this.buildPileCards = [[], [], [], []];
+    this.completedBuildCards = [];
     this.currentPlayerIndex = 0;
     this.gameOver = false;
     this.winner = null;
     this.status = 'playing';
 
     // Deal 5 cards to each player
     this.players.forEach(player => {
       this.refillHand(player);
     });
 
     return this.getState();
   }
 
   refillHand(player) {
+    this.replenishDrawPileIfNeeded();
     while (player.hand.length < 5 && this.drawPile.length > 0) {
       player.hand.push(this.drawPile.pop());
-    }
-    // If draw pile is empty, shuffle all discard piles back
-    if (player.hand.length < 5 && this.drawPile.length === 0) {
-      this.reshuffleDeck();
-      while (player.hand.length < 5 && this.drawPile.length > 0) {
-        player.hand.push(this.drawPile.pop());
-      }
+      this.replenishDrawPileIfNeeded();
     }
   }
 
-  reshuffleDeck() {
-    // Collect cards from discard piles
-    let cards = [];
-    this.players.forEach(p => {
-      p.discardPiles.forEach(pile => {
-        cards = cards.concat(pile);
-        pile.length = 0;
-      });
-    });
-    this.drawPile = this.shuffle(cards);
+  replenishDrawPileIfNeeded() {
+    if (this.drawPile.length > 0 || this.completedBuildCards.length === 0) {
+      return;
+    }
+
+    this.drawPile = this.shuffle(this.completedBuildCards);
+    this.completedBuildCards = [];
   }
 
   // Get top card value (Skip-Bo wildcard = next needed value)
   getEffectiveValue(card, buildPileIndex) {
     if (card === 0) {
       // Wildcard - can be any value
       return (this.buildPiles[buildPileIndex] || 0) + 1;
     }
     return card;
   }
 
   canPlayOnBuild(card, buildPileIndex) {
     const needed = (this.buildPiles[buildPileIndex] || 0) + 1;
     if (card === 0) return needed <= 12; // Wildcard can go anywhere if pile not complete
     return card === needed;
   }
 
   playCardToBuild(playerIndex, cardSource, cardIndex, buildPileIndex) {
     if (this.currentPlayerIndex !== playerIndex) {
       return { success: false, error: 'Not your turn' };
     }
     if (this.gameOver) {
       return { success: false, error: 'Game is over' };
     }
 
@@ -125,63 +121,67 @@ class SkipBoGame {
     if (cardSource === 'hand') {
       if (cardIndex < 0 || cardIndex >= player.hand.length) {
         return { success: false, error: 'Invalid card index' };
       }
       card = player.hand[cardIndex];
     } else if (cardSource === 'stock') {
       if (player.stockPile.length === 0) {
         return { success: false, error: 'Stock pile empty' };
       }
       card = player.stockPile[player.stockPile.length - 1];
     } else if (cardSource === 'discard') {
       const discardPile = player.discardPiles[cardIndex];
       if (!discardPile || discardPile.length === 0) {
         return { success: false, error: 'Discard pile empty' };
       }
       card = discardPile[discardPile.length - 1];
     }
 
     if (!this.canPlayOnBuild(card, buildPileIndex)) {
       return { success: false, error: 'Cannot play this card here' };
     }
 
     // Place card
     const effectiveValue = this.getEffectiveValue(card, buildPileIndex);
     this.buildPiles[buildPileIndex] = effectiveValue;
+    this.buildPileCards[buildPileIndex].push(card);
 
     // Remove from source
     if (cardSource === 'hand') {
       player.hand.splice(cardIndex, 1);
     } else if (cardSource === 'stock') {
       player.stockPile.pop();
     } else if (cardSource === 'discard') {
       player.discardPiles[cardIndex].pop();
     }
 
     // Clear build pile if reached 12
     if (effectiveValue === 12) {
+      this.completedBuildCards = this.completedBuildCards.concat(this.buildPileCards[buildPileIndex]);
+      this.buildPileCards[buildPileIndex] = [];
       this.buildPiles[buildPileIndex] = null;
+      this.replenishDrawPileIfNeeded();
     }
 
     // Check win condition
     if (player.stockPile.length === 0) {
       this.gameOver = true;
       this.winner = playerIndex;
       this.status = 'finished';
     }
 
     // Refill hand if empty
     if (player.hand.length === 0 && !this.gameOver) {
       this.refillHand(player);
     }
 
     return { success: true, state: this.getState() };
   }
 
   discardCard(playerIndex, cardIndex, discardPileIndex) {
     if (this.currentPlayerIndex !== playerIndex) {
       return { success: false, error: 'Not your turn' };
     }
     if (this.gameOver) {
       return { success: false, error: 'Game is over' };
     }
 
