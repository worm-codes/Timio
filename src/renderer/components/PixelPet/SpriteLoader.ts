export type AnimalType = 'dog1' | 'dog2' | 'cat1' | 'cat2' | 'rat1' | 'rat2' | 'bird1' | 'bird2';
export type AnimationType = 'idle' | 'walk' | 'death' | 'hurt' | 'attack';

export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteAnimation {
  name: AnimationType;
  image: HTMLImageElement;
  frames: SpriteFrame[];
  frameCount: number;
  fps: number;
}

export interface SpriteSheet {
  image: HTMLImageElement;
  animations: Map<AnimationType, SpriteAnimation>;
}

const ANIMAL_PATHS: Record<AnimalType, string> = {
  dog1: '1 Dog',
  dog2: '2 Dog 2',
  cat1: '3 Cat',
  cat2: '4 Cat 2',
  rat1: '5 Rat',
  rat2: '6 Rat 2',
  bird1: '7 Bird',
  bird2: '8 Bird 2'
};

const ANIMATION_FILES: Record<AnimationType, string> = {
  idle: 'Idle.png',
  walk: 'Walk.png',
  death: 'Death.png',
  hurt: 'Hurt.png',
  attack: 'Attack.png'
};

export class SpriteLoader {
  private static cache = new Map<string, HTMLImageElement>();

  private static getBasePath(): string {
    if (window.location.protocol === 'http:') {
      // Dev mode - Vite dev server
      return '/';
    } else {
      // Production - use resources path from extraResources
      const resourcesPath = window.electronAPI?.getResourcesPath?.();
      if (resourcesPath && resourcesPath !== '__RESOURCES_PATH__') {
        return `file:///${resourcesPath.replace(/\\/g, '/')}/`;
      }
      // Fallback
      const htmlPath = window.location.href;
      return htmlPath.substring(0, htmlPath.lastIndexOf('resources/') + 10) + 'assets/';
    }
  }

  static async loadImage(path: string): Promise<HTMLImageElement> {
    // Check cache first
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // For production, use IPC to read file
      if (window.location.protocol === 'file:' && window.electronAPI?.readAsset) {
        // Extract relative path from full path
        const match = path.match(/assets\/(.+)$/);
        const relativePath = match ? match[1] : path;
        
        window.electronAPI.readAsset(relativePath)
          .then(base64Data => {
            img.onload = () => {
              this.cache.set(path, img);
              resolve(img);
            };
            img.onerror = reject;
            img.src = base64Data;
          })
          .catch(reject);
      } else {
        // Dev mode - direct loading
        img.onload = () => {
          this.cache.set(path, img);
          resolve(img);
        };
        img.onerror = reject;
        img.src = path;
      }
    });
  }

  static async loadSpriteSheet(animalType: AnimalType): Promise<SpriteSheet> {
    const animalPath = ANIMAL_PATHS[animalType];
    const animations = new Map<AnimationType, SpriteAnimation>();
    
    // Determine which animations this animal has
    const hasAttack = animalType.includes('dog') || animalType.includes('cat');
    const animationsToLoad: AnimationType[] = hasAttack 
      ? ['idle', 'walk', 'death', 'hurt', 'attack']
      : ['idle', 'walk', 'death', 'hurt'];

    // Load each animation
    for (const animType of animationsToLoad) {
      const isDev = window.location.protocol === 'http:';
      
      // Build proper URL with base path
      const basePath = this.getBasePath();
      const relativePath = `${animalPath}/${ANIMATION_FILES[animType]}`;
      
      // Encode spaces and special characters for file:// URLs
      const encodedPath = isDev ? relativePath : encodeURI(relativePath);
      const imagePath = isDev ? `/${encodedPath}` : `${basePath}${encodedPath}`;
      
      console.log(`[${isDev ? 'DEV' : 'PROD'}] Loading sprite: ${imagePath}`);
      
      try {
        const image = await this.loadImage(imagePath);
        const animation = this.parseAnimation(image, animType);
        animation.image = image; // Store the loaded image with the animation
        animations.set(animType, animation);
      } catch (error) {
        console.warn(`Failed to load ${animType} animation for ${animalType}:`, error);
      }
    }

    // Use the first loaded animation's image as reference
    const firstAnimation = animations.values().next().value;
    if (!firstAnimation) {
      throw new Error(`No animations loaded for ${animalType}`);
    }

    return {
      image: firstAnimation.frames[0] ? await this.loadImage(`/${animalPath}/${ANIMATION_FILES['idle']}`) : new Image(),
      animations
    };
  }

  private static parseAnimation(image: HTMLImageElement, animType: AnimationType): SpriteAnimation {
    // Auto-detect frame count based on image dimensions
    // Assume sprites are arranged horizontally and each frame is square
    const frameHeight = image.height;
    const frameWidth = frameHeight; // Assume square frames
    const frameCount = Math.floor(image.width / frameWidth);

    const frames: SpriteFrame[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push({
        x: i * frameWidth,
        y: 0,
        width: frameWidth,
        height: frameHeight
      });
    }

    // Set FPS based on animation type
    const fps = this.getFpsForAnimation(animType);

    return {
      name: animType,
      image: image, // Include the HTMLImageElement
      frames,
      frameCount,
      fps
    };
  }

  private static getFpsForAnimation(animType: AnimationType): number {
    switch (animType) {
      case 'idle':
        return 4; // Slow, calm breathing
      case 'walk':
        return 8; // Moderate movement
      case 'death': // Used as sleep
        return 2; // Very slow
      case 'hurt':
        return 6; // Alert but not frantic
      case 'attack':
        return 10; // Happy, energetic
      default:
        return 6;
    }
  }
}
