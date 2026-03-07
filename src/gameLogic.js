// ============================================================
// Skip-Bo Game Logic
// ============================================================

class SkipBoGame {
  constructor(stackSize = 20, mode = 'computer') {
    this.mode = mode; // 'computer' or 'online'
    this.stackSize = stackSize;
    this.players = [];
    this.buildPiles = [null, null, null, null]; // 4 build piles (1-12 sequence)
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
    while (player.hand.length < 5 && this.drawPile.length > 0) {
      player.hand.push(this.drawPile.pop());
    }
    // If draw pile is empty, shuffle all discard piles back
    if (player.hand.length < 5 && this.drawPile.length === 0) {
      this.reshuffleDeck();
      while (player.hand.length < 5 && this.drawPile.length > 0) {
        player.hand.push(this.drawPile.pop());
      }
    }
  }

  reshuffleDeck() {
    // Collect cards from discard piles
    let cards = [];
    this.players.forEach(p => {
      p.discardPiles.forEach(pile => {
        cards = cards.concat(pile);
        pile.length = 0;
      });
    });
    this.drawPile = this.shuffle(cards);
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

    const player = this.players[playerIndex];
    let card;

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
      this.buildPiles[buildPileIndex] = null;
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

    const player = this.players[playerIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return { success: false, error: 'Invalid card index' };
    }
    if (discardPileIndex < 0 || discardPileIndex > 3) {
      return { success: false, error: 'Invalid discard pile' };
    }

    const card = player.hand.splice(cardIndex, 1)[0];
    player.discardPiles[discardPileIndex].push(card);

    // End turn
    this.endTurn();

    return { success: true, state: this.getState() };
  }

  endTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    const nextPlayer = this.players[this.currentPlayerIndex];
    this.refillHand(nextPlayer);
  }

  // ============================================================
  // Computer AI Logic
  // ============================================================
  computerTurn() {
    if (this.mode !== 'computer' || this.currentPlayerIndex !== 1) return null;

    const player = this.players[1];
    const moves = [];

    // Priority 1: Play stock pile top card
    const stockTop = player.stockPile[player.stockPile.length - 1];
    if (stockTop !== undefined) {
      for (let b = 0; b < 4; b++) {
        if (this.canPlayOnBuild(stockTop, b)) {
          moves.push({ source: 'stock', cardIndex: 0, buildPile: b, priority: 10 });
        }
      }
    }

    // Priority 2: Play hand cards
    player.hand.forEach((card, i) => {
      for (let b = 0; b < 4; b++) {
        if (this.canPlayOnBuild(card, b)) {
          moves.push({ source: 'hand', cardIndex: i, buildPile: b, priority: card === 0 ? 8 : 5 });
        }
      }
    });

    // Priority 3: Play from discard piles
    player.discardPiles.forEach((pile, d) => {
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        for (let b = 0; b < 4; b++) {
          if (this.canPlayOnBuild(topCard, b)) {
            moves.push({ source: 'discard', cardIndex: d, buildPile: b, priority: 3 });
          }
        }
      }
    });

    // Sort by priority
    moves.sort((a, b) => b.priority - a.priority);

    const actionLog = [];

    // Execute moves
    if (moves.length > 0) {
      let madeMove = true;
      while (madeMove && !this.gameOver) {
        madeMove = false;
        // Re-calculate available moves
        const availableMoves = [];

        const st = player.stockPile[player.stockPile.length - 1];
        if (st !== undefined) {
          for (let b = 0; b < 4; b++) {
            if (this.canPlayOnBuild(st, b)) {
              availableMoves.push({ source: 'stock', cardIndex: 0, buildPile: b, priority: 10 });
            }
          }
        }

        player.hand.forEach((card, i) => {
          for (let b = 0; b < 4; b++) {
            if (this.canPlayOnBuild(card, b)) {
              availableMoves.push({ source: 'hand', cardIndex: i, buildPile: b, priority: card === 0 ? 8 : 5 });
            }
          }
        });

        player.discardPiles.forEach((pile, d) => {
          if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            for (let b = 0; b < 4; b++) {
              if (this.canPlayOnBuild(topCard, b)) {
                availableMoves.push({ source: 'discard', cardIndex: d, buildPile: b, priority: 3 });
              }
            }
          }
        });

        availableMoves.sort((a, b) => b.priority - a.priority);

        if (availableMoves.length > 0) {
          const best = availableMoves[0];
          const result = this.playCardToBuild(1, best.source, best.cardIndex, best.buildPile);
          if (result.success) {
            actionLog.push({ type: 'play', source: best.source, cardIndex: best.cardIndex, buildPile: best.buildPile });
            madeMove = true;
          }
        }
      }
    }

    if (!this.gameOver) {
      // Discard a card to end turn - choose least useful card
      if (player.hand.length > 0) {
        // Find best discard pile (empty one preferred)
        let discardPileIdx = 0;
        for (let d = 0; d < 4; d++) {
          if (player.discardPiles[d].length === 0) {
            discardPileIdx = d;
            break;
          }
        }
        // Discard highest non-wildcard card
        let discardCardIdx = 0;
        let maxVal = -1;
        player.hand.forEach((card, i) => {
          if (card > maxVal && card !== 0) {
            maxVal = card;
            discardCardIdx = i;
          }
        });

        this.discardCard(1, discardCardIdx, discardPileIdx);
        actionLog.push({ type: 'discard', cardIndex: discardCardIdx, discardPile: discardPileIdx });
      }
    }

    return { actionLog, state: this.getState() };
  }

  getState(forPlayer = null) {
    return {
      buildPiles: this.buildPiles,
      drawPileCount: this.drawPile.length,
      currentPlayerIndex: this.currentPlayerIndex,
      gameOver: this.gameOver,
      winner: this.winner,
      status: this.status,
      players: this.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        stockPileCount: p.stockPile.length,
        stockPileTop: p.stockPile.length > 0 ? p.stockPile[p.stockPile.length - 1] : null,
        hand: (forPlayer === null || forPlayer === idx) ? p.hand : p.hand.map(() => -1),
        discardPiles: p.discardPiles.map(pile => pile.length > 0 ? pile[pile.length - 1] : null),
        discardPileCards: p.discardPiles.map(pile => [...pile]),
        discardPileCounts: p.discardPiles.map(pile => pile.length),
        isComputer: p.isComputer
      }))
    };
  }
}

module.exports = { SkipBoGame };
