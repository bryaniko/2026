import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import View from '@/View/View.js'
import State from '@/State/State.js'

export default class Buildings
{
    constructor()
    {
        this.view = View.getInstance()
        this.state = State.getInstance()
        this.scene = this.view.scene

        this.gltfLoader = new GLTFLoader()
        this.buildingsState = this.state.buildings
        this.meshes = new Map()

        this.group = new THREE.Group()
        this.scene.add(this.group)

        // Listen for creations/destructions
        this.buildingsState.events.on('create', (buildingData) =>
        {
            this.createMesh(buildingData)
        })

        this.buildingsState.events.on('destroy', (buildingData) =>
        {
            this.destroyMesh(buildingData.id)
        })

        // Create initial existing buildings
        for(const b of this.buildingsState.items)
        {
            this.createMesh(b)
        }
    }

    createBadgeTexture(title, subtext, colorHex)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 280
        canvas.height = 120
        const ctx = canvas.getContext('2d')

        // Background pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)'
        ctx.beginPath()
        ctx.roundRect(10, 10, 260, 100, 20)
        ctx.fill()

        // Border
        ctx.lineWidth = 4
        ctx.strokeStyle = colorHex
        ctx.stroke()

        // Title
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(title, 140, 45)

        // Subtext
        ctx.fillStyle = colorHex
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(subtext, 140, 85)

        const texture = new THREE.CanvasTexture(canvas)
        texture.minFilter = THREE.LinearFilter
        texture.needsUpdate = true
        return texture
    }

    createMesh(building)
    {
        const meshGroup = new THREE.Group()
        const [sx, sy, sz] = building.size
        const config = building.typeConfig

        if(config.modelPath)
        {
            // Load custom Blender GLB model
            this.gltfLoader.load(
                config.modelPath,
                (gltf) =>
                {
                    const model = gltf.scene
                    model.traverse((child) =>
                    {
                        if(child.isMesh)
                        {
                            child.castShadow = true
                            child.receiveShadow = true
                        }
                    })
                    // Offset Y so model stands on ground
                    model.position.y = - sy * 0.5
                    meshGroup.add(model)
                },
                undefined,
                (error) =>
                {
                    console.warn(`Could not load GLB model at ${config.modelPath}, fallback to procedural mesh.`, error)
                    this.buildProceduralMesh(meshGroup, building, sx, sy, sz, config)
                }
            )
        }
        else
        {
            this.buildProceduralMesh(meshGroup, building, sx, sy, sz, config)
        }

        // Floating Badge Tag
        const dimensionsText = `${sx}m x ${sz}m (H: ${sy}m)`
        const badgeTexture = this.createBadgeTexture(`🏠 ${building.name}`, dimensionsText, config.roofColor)
        const spriteMaterial = new THREE.SpriteMaterial({
            map: badgeTexture,
            transparent: true,
            depthTest: false
        })
        const sprite = new THREE.Sprite(spriteMaterial)
        sprite.scale.set(4.5, 2.0, 1)
        sprite.position.y = sy * 0.5 + 4.0
        meshGroup.add(sprite)

        // Set position & rotation
        meshGroup.position.set(building.position[0], building.position[1], building.position[2])
        meshGroup.rotation.y = building.rotationY

        this.group.add(meshGroup)
        this.meshes.set(building.id, { group: meshGroup, sprite, spriteMaterial, badgeTexture, building })
    }

    buildProceduralMesh(meshGroup, building, sx, sy, sz, config)
    {
        // Material setup
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(config.wallColor),
            roughness: 0.5,
            metalness: 0.1
        })

        const roofMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(config.roofColor),
            roughness: 0.3,
            metalness: 0.2
        })

        const doorMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(config.doorColor),
            roughness: 0.8
        })

        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x90e0ef,
            emissive: 0x0077b6,
            emissiveIntensity: 0.4,
            roughness: 0.1,
            metalness: 0.9
        })

        // 1. Main Body / Wall Mesh
        const wallGeo = new THREE.BoxGeometry(sx, sy, sz)
        const wallMesh = new THREE.Mesh(wallGeo, wallMaterial)
        wallMesh.castShadow = true
        wallMesh.receiveShadow = true
        meshGroup.add(wallMesh)

        // Wall Outline Edges
        const edges = new THREE.EdgesGeometry(wallGeo)
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
        )
        meshGroup.add(line)

        // 2. Roof Mesh according to Type
        if(building.name === 'House' || building.name === 'Tower')
        {
            const roofHeight = building.name === 'House' ? 2.5 : 3.5
            const roofRadius = Math.max(sx, sz) * 0.72
            const roofGeo = new THREE.ConeGeometry(roofRadius, roofHeight, 4)
            const roofMesh = new THREE.Mesh(roofGeo, roofMaterial)
            roofMesh.position.y = sy * 0.5 + roofHeight * 0.5
            roofMesh.rotation.y = Math.PI * 0.25
            roofMesh.castShadow = true
            meshGroup.add(roofMesh)
        }
        else if(building.name === 'ModernVilla')
        {
            // Flat terrace roof overhang
            const roofGeo = new THREE.BoxGeometry(sx + 0.8, 0.4, sz + 0.8)
            const roofMesh = new THREE.Mesh(roofGeo, roofMaterial)
            roofMesh.position.y = sy * 0.5 + 0.2
            roofMesh.castShadow = true
            meshGroup.add(roofMesh)
        }
        else if(building.name === 'Skyscraper')
        {
            // Top spire / antenna
            const antennaGeo = new THREE.CylinderGeometry(0.15, 0.25, 4, 8)
            const antennaMesh = new THREE.Mesh(antennaGeo, roofMaterial)
            antennaMesh.position.y = sy * 0.5 + 2
            meshGroup.add(antennaMesh)
        }

        // 3. Front Door
        const doorWidth = 1.2
        const doorHeight = 2.2
        const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.15)
        const doorMesh = new THREE.Mesh(doorGeo, doorMaterial)
        doorMesh.position.set(0, - sy * 0.5 + doorHeight * 0.5, sz * 0.5 + 0.08)
        meshGroup.add(doorMesh)

        // 4. Windows
        const windowGeo = new THREE.BoxGeometry(1.0, 1.2, 0.1)
        const windowLeft = new THREE.Mesh(windowGeo, windowMaterial)
        windowLeft.position.set(- sx * 0.28, 0.3, sz * 0.5 + 0.06)
        meshGroup.add(windowLeft)

        const windowRight = new THREE.Mesh(windowGeo, windowMaterial)
        windowRight.position.set(sx * 0.28, 0.3, sz * 0.5 + 0.06)
        meshGroup.add(windowRight)
    }

    destroyMesh(id)
    {
        const item = this.meshes.get(id)
        if(!item) return

        this.group.remove(item.group)
        if(item.badgeTexture) item.badgeTexture.dispose()
        if(item.spriteMaterial) item.spriteMaterial.dispose()
        this.meshes.delete(id)
    }

    update()
    {
        const playerPos = this.state.player.position.current
        const maxVisibleDist = 200

        for(const [id, item] of this.meshes)
        {
            const b = item.building
            item.group.position.set(b.position[0], b.position[1], b.position[2])
            item.group.rotation.y = b.rotationY

            // Fade badge opacity based on distance to player
            const dist = Math.hypot(b.position[0] - playerPos[0], b.position[2] - playerPos[2])
            if(dist > maxVisibleDist)
            {
                item.sprite.visible = false
            }
            else
            {
                item.sprite.visible = true
                const fade = Math.max(0, Math.min(1, 1 - (dist - 40) / 80))
                item.spriteMaterial.opacity = fade
            }
        }
    }

    destroy()
    {
        for(const [id, item] of this.meshes)
        {
            this.destroyMesh(id)
        }
        this.scene.remove(this.group)
    }
}
