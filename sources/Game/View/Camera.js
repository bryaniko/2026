import * as THREE from 'three'

import View from '@/View/View.js'
import State from '@/State/State.js'

export default class Camera
{
    constructor(_options)
    {
        // Options
        this.state = State.getInstance()
        this.view = View.getInstance()
        this.scene = this.view.scene
        this.viewport = this.state.viewport

        this.setInstance()
    }

    setInstance()
    {
        // Set up
        this.instance = new THREE.PerspectiveCamera(45, this.viewport.width / this.viewport.height, 0.1, 5000)
        this.instance.rotation.reorder('YXZ')

        this.scene.add(this.instance)
    }

    resize()
    {
        this.instance.aspect = this.viewport.width / this.viewport.height
        this.instance.updateProjectionMatrix()
    }

    update()
    {
        const playerState = this.state.player

        // Apply coordinates from view
        this.instance.position.set(playerState.camera.position[0], playerState.camera.position[1], playerState.camera.position[2])
        // gl-matrix quat layout: [x, y, z, w]
        this.instance.quaternion.set(playerState.camera.quaternion[0], playerState.camera.quaternion[1], playerState.camera.quaternion[2], playerState.camera.quaternion[3])
    }

    destroy()
    {
    }
}