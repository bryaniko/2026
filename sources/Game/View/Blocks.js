import * as THREE from 'three'
import View from '@/View/View.js'
import State from '@/State/State.js'
import PlayerMaterial from './Materials/PlayerMaterial.js'

export default class Blocks
{
    constructor()
    {
        this.view = View.getInstance()
        this.state = State.getInstance()
        this.scene = this.view.scene

        this.blocksState = this.state.blocks
        this.meshes = new Map()

        this.group = new THREE.Group()
        this.scene.add(this.group)

        // Shared materials cache using custom Sun Shading shader
        this.materialsMap = new Map()

        // Shared Box Geometry template (unit cube)
        this.boxGeometry = new THREE.BoxGeometry(1, 1, 1)

        // Listen for creations/destructions
        this.blocksState.events.on('create', (blockData) =>
        {
            this.createMesh(blockData)
        })

        this.blocksState.events.on('destroy', (blockData) =>
        {
            this.destroyMesh(blockData.id)
        })

        // Create any existing blocks
        for(const block of this.blocksState.items)
        {
            this.createMesh(block)
        }
    }

    getMaterial(matConfig)
    {
        if(this.materialsMap.has(matConfig.name))
            return this.materialsMap.get(matConfig.name)

        const material = new PlayerMaterial()
        material.uniforms.uColor.value = new THREE.Color(matConfig.color)
        material.uniforms.uSunPosition.value = new THREE.Vector3(- 0.5, - 0.5, - 0.5)

        this.materialsMap.set(matConfig.name, material)
        return material
    }

    createBadgeTexture(text, subtext, color)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 128
        const ctx = canvas.getContext('2d')

        // Background pill
        ctx.fillStyle = 'rgba(18, 22, 28, 0.88)'
        ctx.beginPath()
        ctx.roundRect(10, 10, 236, 108, 24)
        ctx.fill()

        // Border outline
        ctx.lineWidth = 5
        ctx.strokeStyle = color
        ctx.stroke()

        // Primary mass text
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 128, 48)

        // Subtext (Material name)
        ctx.fillStyle = color
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(subtext, 128, 88)

        const texture = new THREE.CanvasTexture(canvas)
        texture.minFilter = THREE.LinearFilter
        texture.needsUpdate = true
        return texture
    }

    createMesh(block)
    {
        const meshGroup = new THREE.Group()

        // 1. Box Mesh with custom sun-shaded material
        const material = this.getMaterial(block.material)
        const mesh = new THREE.Mesh(this.boxGeometry, material)
        mesh.scale.set(block.size[0], block.size[1], block.size[2])
        meshGroup.add(mesh)

        // 2. Outlines / Edge Highlight
        const edges = new THREE.EdgesGeometry(this.boxGeometry)
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
        )
        line.scale.set(block.size[0], block.size[1], block.size[2])
        meshGroup.add(line)

        // 3. Weight badge sprite floating above block
        const massString = block.mass >= 1000
            ? `${(block.mass / 1000).toFixed(1)} t`
            : `${block.mass} kg`

        const badgeTexture = this.createBadgeTexture(massString, block.name, block.material.color)
        const spriteMaterial = new THREE.SpriteMaterial({
            map: badgeTexture,
            transparent: true,
            depthTest: false
        })
        const sprite = new THREE.Sprite(spriteMaterial)
        const spriteScale = Math.max(1.5, Math.min(3.2, block.radius * 1.5))
        sprite.scale.set(spriteScale * 1.5, spriteScale * 0.75, 1)
        sprite.position.y = block.halfSize[1] + spriteScale * 0.45 + 0.2
        meshGroup.add(sprite)

        // Position & rotation
        meshGroup.position.set(block.position[0], block.position[1], block.position[2])
        meshGroup.rotation.set(block.rotation[0], block.rotation[1], block.rotation[2])

        this.group.add(meshGroup)
        this.meshes.set(block.id, { group: meshGroup, mesh, sprite, spriteMaterial, badgeTexture, block })
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
        const sunState = this.state.sun
        const maxVisibleDist = 180

        // Update sun position on materials
        for(const [name, material] of this.materialsMap)
        {
            material.uniforms.uSunPosition.value.set(sunState.position.x, sunState.position.y, sunState.position.z)
        }

        for(const [id, item] of this.meshes)
        {
            const b = item.block
            item.group.position.set(b.position[0], b.position[1], b.position[2])
            item.group.rotation.set(b.rotation[0], b.rotation[1], b.rotation[2])

            // Fade badge opacity smoothly based on distance to player
            const dist = Math.hypot(b.position[0] - playerPos[0], b.position[2] - playerPos[2])
            if(dist > maxVisibleDist)
            {
                item.sprite.visible = false
            }
            else
            {
                item.sprite.visible = true
                const fade = Math.max(0, Math.min(1, 1 - (dist - 40) / 60))
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
