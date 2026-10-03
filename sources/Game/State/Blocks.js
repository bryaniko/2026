import EventsEmitter from 'events'
import { vec3 } from 'gl-matrix'
import Game from '@/Game.js'
import State from '@/State/State.js'

export default class Blocks
{
    constructor()
    {
        this.game = Game.getInstance()
        this.state = State.getInstance()
        this.events = new EventsEmitter()

        this.items = []
        this.lastId = 0
        this.gravity = - 22
        this.playerMass = 80 // kg

        this.materials = [
            { name: 'Foam', density: 60, color: '#ff70a6', restitution: 0.7, friction: 0.88 },
            { name: 'Wood', density: 600, color: '#e09f3e', restitution: 0.4, friction: 0.92 },
            { name: 'Stone', density: 2400, color: '#8d99ae', restitution: 0.15, friction: 0.95 },
            { name: 'Iron', density: 7800, color: '#4a6fa5', restitution: 0.1, friction: 0.97 },
            { name: 'Gold', density: 19300, color: '#ffd166', restitution: 0.05, friction: 0.98 }
        ]

        this.spawnInitialBlocks()
        this.setControls()
        this.setDebug()
    }

    setControls()
    {
        this.state.controls.events.on('spawnBlockDown', () =>
        {
            this.spawnInFrontOfPlayer()
        })
    }

    spawnInitialBlocks()
    {
        // Spawn 35 initial random blocks around starting area
        for(let i = 0; i < 35; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const dist = 6 + Math.random() * 60
            const x = 10 + Math.cos(angle) * dist
            const z = 1 + Math.sin(angle) * dist
            this.createRandomBlock(x, 2 + Math.random() * 8, z)
        }
    }

    spawnInFrontOfPlayer()
    {
        const player = this.state.player
        const rotation = player.rotation
        const forwardX = - Math.sin(rotation)
        const forwardZ = - Math.cos(rotation)

        const spawnX = player.position.current[0] + forwardX * 3.5
        const spawnZ = player.position.current[2] + forwardZ * 3.5
        const spawnY = player.position.current[1] + 3.0

        const block = this.createRandomBlock(spawnX, spawnY, spawnZ)
        // Give slight forward nudge
        block.velocity[0] = forwardX * 3
        block.velocity[2] = forwardZ * 3
        return block
    }

    createBlock(options = {})
    {
        const id = this.lastId++

        const mat = options.material || this.materials[Math.floor(Math.random() * this.materials.length)]
        const sizeX = options.sizeX || (0.6 + Math.random() * 1.8)
        const sizeY = options.sizeY || (0.6 + Math.random() * 1.8)
        const sizeZ = options.sizeZ || (0.6 + Math.random() * 1.8)

        const volume = sizeX * sizeY * sizeZ // m^3
        const mass = Math.max(1, Math.round(mat.density * volume)) // kg

        const block = {
            id: id,
            name: mat.name,
            material: mat,
            size: [sizeX, sizeY, sizeZ],
            halfSize: [sizeX * 0.5, sizeY * 0.5, sizeZ * 0.5],
            radius: Math.hypot(sizeX, sizeZ) * 0.5,
            mass: mass,
            volume: volume,
            position: [options.x ?? 0, options.y ?? sizeY * 0.5, options.z ?? 0],
            velocity: [options.vx ?? 0, options.vy ?? 0, options.vz ?? 0],
            rotation: [0, Math.random() * Math.PI * 2, 0],
            angularVelocity: [0, (Math.random() - 0.5) * 0.5, 0],
            friction: mat.friction,
            restitution: mat.restitution,
            isSleeping: false
        }

        this.items.push(block)
        this.events.emit('create', block)
        return block
    }

    createRandomBlock(x, y, z)
    {
        // Random dimensions (some uniform cubes, some slabs, some tall pillars)
        const type = Math.random()
        let sx, sy, sz

        if(type < 0.4)
        {
            // Cube
            const s = 0.6 + Math.random() * 1.6
            sx = s; sy = s; sz = s
        }
        else if(type < 0.7)
        {
            // Slab / box
            sx = 0.8 + Math.random() * 2.0
            sy = 0.5 + Math.random() * 0.8
            sz = 0.8 + Math.random() * 2.0
        }
        else
        {
            // Tall column / block
            sx = 0.7 + Math.random() * 1.2
            sy = 1.4 + Math.random() * 2.2
            sz = 0.7 + Math.random() * 1.2
        }

        const mat = this.materials[Math.floor(Math.random() * this.materials.length)]

        return this.createBlock({
            x: x,
            y: y,
            z: z,
            sizeX: sx,
            sizeY: sy,
            sizeZ: sz,
            material: mat
        })
    }

    update()
    {
        const dt = Math.min(this.state.time.delta, 0.05)
        if(dt <= 0) return

        const player = this.state.player
        const playerPos = player.position.current
        const playerDelta = player.position.delta
        const playerRadius = 0.75
        const playerSpeed = player.speed / (dt || 0.016)

        // Physics step for all blocks
        for(let i = 0; i < this.items.length; i++)
        {
            const b = this.items[i]

            // Apply gravity
            b.velocity[1] += this.gravity * dt

            // Integrate position
            b.position[0] += b.velocity[0] * dt
            b.position[1] += b.velocity[1] * dt
            b.position[2] += b.velocity[2] * dt

            // Integrate rotation
            b.rotation[0] += b.angularVelocity[0] * dt
            b.rotation[1] += b.angularVelocity[1] * dt
            b.rotation[2] += b.angularVelocity[2] * dt

            // Ground collision (flat terrain Y = 0)
            const groundY = b.halfSize[1]
            if(b.position[1] <= groundY)
            {
                b.position[1] = groundY

                if(b.velocity[1] < 0)
                {
                    if(Math.abs(b.velocity[1]) > 0.5)
                        b.velocity[1] = - b.velocity[1] * b.restitution
                    else
                        b.velocity[1] = 0
                }

                // Ground friction
                const groundDamping = Math.pow(b.friction, dt * 60)
                b.velocity[0] *= groundDamping
                b.velocity[2] *= groundDamping
                b.angularVelocity[0] *= groundDamping
                b.angularVelocity[1] *= groundDamping
                b.angularVelocity[2] *= groundDamping

                // Stop microscopic jitter
                if(Math.abs(b.velocity[0]) < 0.005) b.velocity[0] = 0
                if(Math.abs(b.velocity[2]) < 0.005) b.velocity[2] = 0
            }

            // Air drag
            b.velocity[0] *= 0.995
            b.velocity[2] *= 0.995

            // Player vs Block Collision
            const dx = b.position[0] - playerPos[0]
            const dz = b.position[2] - playerPos[2]
            const dist = Math.hypot(dx, dz)
            const minDist = playerRadius + b.radius

            if(dist < minDist && b.position[1] < playerPos[1] + 2.0 && b.position[1] + b.halfSize[1] > playerPos[1] - 0.2)
            {
                const overlap = minDist - dist
                const nx = dist > 0.0001 ? dx / dist : 1
                const nz = dist > 0.0001 ? dz / dist : 0

                // Mass ratio factor
                // Light block (< 80kg): easily pushed, player hardly slowed down
                // Heavy block (> 1000kg): behaves almost solid, stops player
                const massRatio = this.playerMass / (this.playerMass + b.mass)
                const pushSpeed = Math.max(playerSpeed, 2.0)

                // Impulse applied to block
                const impulse = pushSpeed * massRatio * 2.2
                b.velocity[0] += nx * impulse
                b.velocity[2] += nz * impulse

                // Slight spin on impact
                b.angularVelocity[1] += (Math.random() - 0.5) * impulse * 0.5

                // Separate block & player based on mass
                b.position[0] += nx * overlap * massRatio
                b.position[2] += nz * overlap * massRatio

                // Player resistance if block is heavy
                const playerResist = 1 - massRatio
                player.position.current[0] -= nx * overlap * playerResist
                player.position.current[2] -= nz * overlap * playerResist
            }

            // Block vs Block collisions
            for(let j = i + 1; j < this.items.length; j++)
            {
                const b2 = this.items[j]
                const bdx = b2.position[0] - b.position[0]
                const bdz = b2.position[2] - b.position[2]
                const bdist = Math.hypot(bdx, bdz)
                const minBdist = b.radius + b2.radius

                if(bdist < minBdist && Math.abs(b2.position[1] - b.position[1]) < (b.halfSize[1] + b2.halfSize[1]))
                {
                    const boverlap = minBdist - bdist
                    const bnx = bdist > 0.0001 ? bdx / bdist : 1
                    const bnz = bdist > 0.0001 ? bdz / bdist : 0

                    const totalMass = b.mass + b2.mass
                    const r1 = b2.mass / totalMass
                    const r2 = b.mass / totalMass

                    b.position[0] -= bnx * boverlap * r1 * 0.5
                    b.position[2] -= bnz * boverlap * r1 * 0.5
                    b2.position[0] += bnx * boverlap * r2 * 0.5
                    b2.position[2] += bnz * boverlap * r2 * 0.5

                    // Transfer horizontal velocities (elastic collision)
                    const vRelX = b.velocity[0] - b2.velocity[0]
                    const vRelZ = b.velocity[2] - b2.velocity[2]
                    const vNorm = vRelX * bnx + vRelZ * bnz

                    if(vNorm > 0)
                    {
                        const impulseVal = (1 + Math.min(b.restitution, b2.restitution)) * vNorm / totalMass
                        b.velocity[0] -= bnx * impulseVal * b2.mass
                        b.velocity[2] -= bnz * impulseVal * b2.mass
                        b2.velocity[0] += bnx * impulseVal * b.mass
                        b2.velocity[2] += bnz * impulseVal * b.mass
                    }
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

        const folder = debug.ui.getFolder('state/blocks')
        folder.add(this, 'gravity').min(-50).max(0).step(1).name('Gravity')
        folder.add({ spawn: () => this.spawnInFrontOfPlayer() }, 'spawn').name('Spawn Block (E)')
        folder.add({ clear: () => this.clear() }, 'clear').name('Clear All Blocks')
    }
}
