import EventsEmitter from 'events'
import Game from '@/Game.js'
import State from '@/State/State.js'

export default class Buildings
{
    constructor()
    {
        this.game = Game.getInstance()
        this.state = State.getInstance()
        this.events = new EventsEmitter()

        this.items = []
        this.lastId = 0

        this.types = [
            {
                name: 'CustomBlender',
                sizeX: 10,
                sizeY: 8,
                sizeZ: 10,
                wallColor: '#ffb703',
                roofColor: '#fb8500',
                doorColor: '#023e8a',
                modelPath: '/models/bangunan_ku.glb'
            },
            {
                name: 'House',
                sizeX: 6,
                sizeY: 4.5,
                sizeZ: 6,
                wallColor: '#d6ccc2',
                roofColor: '#d90429',
                doorColor: '#7f5539'
            },
            {
                name: 'Tower',
                sizeX: 5,
                sizeY: 12,
                sizeZ: 5,
                wallColor: '#8d99ae',
                roofColor: '#2b2d42',
                doorColor: '#4a5759'
            },
            {
                name: 'ModernVilla',
                sizeX: 9,
                sizeY: 5.5,
                sizeZ: 7,
                wallColor: '#f8f9fa',
                roofColor: '#212529',
                doorColor: '#0077b6'
            },
            {
                name: 'Skyscraper',
                sizeX: 8,
                sizeY: 20,
                sizeZ: 8,
                wallColor: '#4a6fa5',
                roofColor: '#1d3557',
                doorColor: '#e63946'
            }
        ]

        // Wait for terrain/chunks to initialize before spawning initial buildings
        setTimeout(() =>
        {
            this.spawnInitialBuildings()
        }, 1000)

        this.setControls()
        this.setDebug()
    }

    setControls()
    {
        this.state.controls.events.on('spawnBuildingDown', () =>
        {
            this.spawnInFrontOfPlayer()
        })
    }

    spawnInitialBuildings()
    {
        const locations = [
            { x: 15, z: 10, type: 'CustomBlender' },
            { x: -22, z: 25, type: 'Tower' },
            { x: 30, z: -20, type: 'ModernVilla' },
            { x: -35, z: -15, type: 'Skyscraper' },
            { x: 5, z: 40, type: 'House' }
        ]

        for(const loc of locations)
        {
            this.createBuilding(loc)
        }
    }

    spawnInFrontOfPlayer(typeName = null)
    {
        const player = this.state.player
        const rotation = player.rotation
        const forwardX = - Math.sin(rotation)
        const forwardZ = - Math.cos(rotation)

        const spawnX = player.position.current[0] + forwardX * 10
        const spawnZ = player.position.current[2] + forwardZ * 10

        const type = typeName || this.types[Math.floor(Math.random() * this.types.length)].name

        return this.createBuilding({
            x: spawnX,
            z: spawnZ,
            type: type
        })
    }

    createBuilding(options = {})
    {
        const id = this.lastId++

        const typeConfig = this.types.find(t => t.name === options.type) || this.types[0]

        const sizeX = options.sizeX || typeConfig.sizeX
        const sizeY = options.sizeY || typeConfig.sizeY
        const sizeZ = options.sizeZ || typeConfig.sizeZ

        const x = options.x ?? 0
        const z = options.z ?? 0

        // Get ground elevation from terrain chunk
        const elevation = this.state.chunks ? (this.state.chunks.getElevationForPosition(x, z) || 0) : 0
        const y = elevation + sizeY * 0.5

        const building = {
            id: id,
            name: typeConfig.name,
            typeConfig: typeConfig,
            size: [sizeX, sizeY, sizeZ],
            halfSize: [sizeX * 0.5, sizeY * 0.5, sizeZ * 0.5],
            radius: Math.hypot(sizeX, sizeZ) * 0.5,
            position: [x, y, z],
            groundY: elevation,
            rotationY: options.rotationY || 0,
            solid: true
        }

        this.items.push(building)
        this.events.emit('create', building)
        return building
    }

    update()
    {
        const player = this.state.player
        const playerPos = player.position.current
        const playerRadius = 0.75

        // Solid Physics: Building vs Player Collision
        for(let i = 0; i < this.items.length; i++)
        {
            const b = this.items[i]
            if(!b.solid) continue

            const dx = playerPos[0] - b.position[0]
            const dz = playerPos[2] - b.position[2]

            const minX = b.halfSize[0] + playerRadius
            const minZ = b.halfSize[2] + playerRadius

            // Check if player is horizontally overlapping with building
            if(Math.abs(dx) < minX && Math.abs(dz) < minZ)
            {
                // Check Y elevation (is player on ground/wall level, or above the roof?)
                const buildingTopY = b.position[1] + b.halfSize[1]
                const playerFeetY = playerPos[1]

                if(playerFeetY < buildingTopY - 0.2)
                {
                    // Player is inside building height -> push player outside walls
                    const overlapX = minX - Math.abs(dx)
                    const overlapZ = minZ - Math.abs(dz)

                    if(overlapX < overlapZ)
                    {
                        playerPos[0] += dx > 0 ? overlapX : -overlapX
                    }
                    else
                    {
                        playerPos[2] += dz > 0 ? overlapZ : -overlapZ
                    }
                }
                else
                {
                    // Player is standing on top of building roof
                    playerPos[1] = Math.max(playerPos[1], buildingTopY)
                }
            }
        }
    }

    clear()
    {
        while(this.items.length > 0)
        {
            const b = this.items.pop()
            this.events.emit('destroy', b)
        }
    }

    setDebug()
    {
        const debug = this.game.debug
        if(!debug || !debug.active) return

        const folder = debug.ui.getFolder('state/buildings')
        folder.add({ spawn: () => this.spawnInFrontOfPlayer() }, 'spawn').name('Spawn Building (B)')
        folder.add({ clear: () => this.clear() }, 'clear').name('Clear All Buildings')
    }
}
