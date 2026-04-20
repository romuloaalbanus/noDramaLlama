const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const btnStart = document.getElementById('start-button');

const CONFIG = {
  OBSTACLE_SPEED: -6,
  GRAVITY: 0.3,
  FRICTION: 0.9,
  JUMP_FORCE: 18,
  MAX_JUMPS: 2,
  BG_SPEED: -2,
  SCORE_INTERVAL: 10,
  SPAWN_MIN_INTERVAL: 70,
  SPAWN_MAX_EXTRA: 140,
  OBSTACLE_Y_OFFSET: 80,
  PLAYER_FLOOR_OFFSET: 90,
  SPEED_INCREMENT: 1.5,
  SPAWN_REDUCTION: 10,
  MIN_SPAWN_INTERVAL: 35,
  LEVEL_THRESHOLD: 20,
};

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function loadAudio(src, volume = 0.1) {
  const audio = new Audio(src);
  audio.volume = volume;
  return audio;
}

const images = {
  background: loadImage('./images/BG2.png'),
  gameOver: loadImage('./images/gameOverBlack.png'),
  player: [
    loadImage('./images/llama1.png'),
    loadImage('./images/llama2.png'),
    loadImage('./images/llama3.png'),
    loadImage('./images/llama4.png'),
  ],
  cactus: [
    loadImage('./images/DesertTileset/png/Objects/Cactus1.png'),
    loadImage('./images/DesertTileset/png/Objects/Cactus2.png'),
    loadImage('./images/DesertTileset/png/Objects/Cactus3.png'),
  ],
};

const sounds = {
  intro: loadAudio('./sound/full.mp3'),
  game: loadAudio('./sound/Loop.wav'),
  gameOver: loadAudio('./sound/end.mp3'),
  jump: loadAudio('./sound/jump.mp3'),
};
sounds.game.loop = true;

class Background {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.x = 0;
  }

  update() {
    this.x += CONFIG.BG_SPEED;
    if (this.x <= -this.canvas.width) {
      this.x = 0;
    }
    this.draw();
  }

  draw() {
    this.ctx.drawImage(images.background, this.x, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(images.background, this.x + this.canvas.width, 0, this.canvas.width, this.canvas.height);
  }
}

class Player {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.x = 20;
    this.y = canvas.height - CONFIG.PLAYER_FLOOR_OFFSET;
    this.width = 50;
    this.height = 60;
    this.speedY = 0;
    this.spriteCount = 0;
    this.jumping = false;
    this.jumpsLeft = CONFIG.MAX_JUMPS;
  }

  update() {
    this.applyGravity();
    this.draw();
  }

  applyGravity() {
    this.speedY += CONFIG.GRAVITY;
    this.y += this.speedY;
    this.speedY *= CONFIG.FRICTION;

    const floor = this.canvas.height - CONFIG.PLAYER_FLOOR_OFFSET;
    if (this.y >= floor) {
      this.y = floor;
      this.speedY = 0;
      this.jumpsLeft = CONFIG.MAX_JUMPS;
      this.jumping = false;
    }
  }

  jump() {
    if (this.jumpsLeft <= 0) return false;
    this.speedY = -CONFIG.JUMP_FORCE;
    this.jumping = true;
    this.jumpsLeft--;
    return true;
  }

  draw() {
    if (this.jumping) {
      this.drawJump();
    } else {
      this.drawRun();
    }
  }

  drawRun() {
    const frame = Math.floor(this.spriteCount / 2) % 4;
    this.ctx.drawImage(images.player[frame], this.x, this.y, this.width, this.height);
    this.spriteCount = (this.spriteCount + 1) % 8;
  }

  drawJump() {
    let frame;
    if (this.spriteCount < 2) {
      frame = 0;
    } else if (this.spriteCount < 16) {
      frame = 1;
    } else {
      frame = 2;
    }
    this.ctx.drawImage(images.player[frame], this.x, this.y, this.width, this.height);
    this.spriteCount = (this.spriteCount + 1) % 30;
  }

  left()   { return this.x; }
  right()  { return this.x + this.width; }
  top()    { return this.y; }
  bottom() { return this.y + this.height; }

  isCrashedWith(obstacle) {
    return !(
      this.bottom() < obstacle.top() ||
      this.top()    > obstacle.bottom() ||
      this.right()  < obstacle.left() ||
      this.left()   > obstacle.right()
    );
  }
}

class Obstacle {
  constructor(canvas, ctx, spriteIndex) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.sprite = images.cactus[spriteIndex];
    this.x = canvas.width;
    this.y = canvas.height - CONFIG.OBSTACLE_Y_OFFSET;
    this.width = 50;
    this.height = 50;
  }

  update(speed = CONFIG.OBSTACLE_SPEED) {
    this.x += speed;
    this.draw();
  }

  draw() {
    this.ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
  }

  left()   { return this.x; }
  right()  { return this.x + this.width; }
  top()    { return this.y; }
  bottom() { return this.y + this.height; }
}

class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.frames = 0;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('noDramaLlama_highScore') || '0');
    this.animationId = null;
    this.obstacles = [];
    this.background = new Background(canvas, ctx);
    this.player = new Player(canvas, ctx);
    this.nextSpawn = CONFIG.SPAWN_MIN_INTERVAL;
  }

  start() {
    sounds.intro.pause();
    sounds.game.play();
    this.animationId = requestAnimationFrame(this.update);
  }

  update = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.background.update();
    this.player.update();
    this.spawnObstacle();
    this.updateObstacles();
    this.drawScore();

    this.frames++;

    if (this.checkCollision()) {
      this.gameOver();
      return;
    }

    this.animationId = requestAnimationFrame(this.update);
  };

  get level() {
    return Math.floor(this.score / CONFIG.LEVEL_THRESHOLD) + 1;
  }

  get currentSpeed() {
    return CONFIG.OBSTACLE_SPEED - (this.level - 1) * CONFIG.SPEED_INCREMENT;
  }

  get currentSpawnMin() {
    return Math.max(CONFIG.MIN_SPAWN_INTERVAL, CONFIG.SPAWN_MIN_INTERVAL - (this.level - 1) * CONFIG.SPAWN_REDUCTION);
  }

  spawnObstacle() {
    if (this.frames >= this.nextSpawn) {
      const spriteIndex = Math.floor(Math.random() * 3);
      this.obstacles.push(new Obstacle(this.canvas, this.ctx, spriteIndex));
      this.nextSpawn = this.frames + this.currentSpawnMin + Math.floor(Math.random() * CONFIG.SPAWN_MAX_EXTRA);
    }
  }

  updateObstacles() {
    const speed = this.currentSpeed;
    for (const obs of this.obstacles) {
      obs.update(speed);
    }
    this.obstacles = this.obstacles.filter(obs => obs.right() > 0);
  }

  drawScore() {
    if (this.frames % CONFIG.SCORE_INTERVAL === 0) {
      this.score++;
    }
    this.ctx.fillStyle = 'black';
    this.ctx.font = '20px Chelsea Market';
    this.ctx.fillText(`Score: ${this.score}`, this.canvas.width - 120, 30);
    this.ctx.fillText(`Best: ${this.highScore}`, this.canvas.width - 120, 55);
    this.ctx.fillText(`Level: ${this.level}`, 20, 30);
  }

  checkCollision() {
    return this.obstacles.some(obs => this.player.isCrashedWith(obs));
  }

  gameOver() {
    cancelAnimationFrame(this.animationId);
    sounds.game.pause();
    sounds.gameOver.play();

    const isNewRecord = this.score > this.highScore;
    if (isNewRecord) {
      localStorage.setItem('noDramaLlama_highScore', this.score);
    }

    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(images.gameOver, 0, 100, 650, 216);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '35px Chelsea Market';
    this.ctx.fillText(`Score: ${this.score}  |  Level: ${this.level}`, 150, 370);
    if (isNewRecord) {
      this.ctx.fillStyle = '#f5c542';
      this.ctx.font = '22px Chelsea Market';
      this.ctx.fillText('New record!', 265, 405);
    } else {
      this.ctx.fillStyle = '#aaaaaa';
      this.ctx.font = '22px Chelsea Market';
      this.ctx.fillText(`Best: ${this.highScore}`, 280, 405);
    }
  }
}

window.addEventListener('load', () => {
  sounds.intro.play().catch(() => {});

  let game = null;

  document.addEventListener('keydown', (event) => {
    if (event.key === ' ' && game) {
      if (game.player.jump()) {
        sounds.jump.play();
      }
    }
  });

  btnStart.addEventListener('click', () => {
    if (!game) {
      game = new Game(canvas, ctx);
      game.start();
      btnStart.blur();
    } else {
      window.location.reload();
    }
  });
});
