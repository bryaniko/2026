uniform vec3 uPlayerPosition;
uniform float uLightnessSmoothness;
uniform float uFresnelOffset;
uniform float uFresnelScale;
uniform float uFresnelPower;
uniform vec3 uSunPosition;
uniform float uGrassDistance;
uniform sampler2D uTexture;
uniform sampler2D uFogTexture;

varying vec3 vColor;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl
#include ../partials/getSunShade.glsl;
#include ../partials/getSunShadeColor.glsl;
#include ../partials/getSunReflection.glsl;
#include ../partials/getSunReflectionColor.glsl;
#include ../partials/getFogColor.glsl;
#include ../partials/getGrassAttenuation.glsl;
#include ../partials/perlin2d.glsl;

// ------- Road Pattern -------
// Returns 0.0 = no road, 1.0 = road center
float getRoadMask(vec2 worldXZ)
{
    // Road spacing: one road every 'spacing' units
    float spacing = 80.0;

    // -- North-South roads (run along Z axis) --
    // Each road wiggles slightly using perlin noise
    float nsLane = worldXZ.x / spacing;
    float nsRoadIndex = floor(nsLane + 0.5); // nearest road grid line
    float nsWiggle = perlin2d(vec2(nsRoadIndex * 3.7 + 11.3, worldXZ.y * 0.02)) * 6.0;
    float nsDist = abs(worldXZ.x - nsRoadIndex * spacing - nsWiggle);
    float nsRoad = 1.0 - smoothstep(3.5, 5.5, nsDist);

    // -- East-West roads (run along X axis) --
    float ewLane = worldXZ.y / spacing;
    float ewRoadIndex = floor(ewLane + 0.5);
    float ewWiggle = perlin2d(vec2(worldXZ.x * 0.02, ewRoadIndex * 4.1 + 7.9)) * 6.0;
    float ewDist = abs(worldXZ.y - ewRoadIndex * spacing - ewWiggle);
    float ewRoad = 1.0 - smoothstep(3.5, 5.5, ewDist);

    return clamp(nsRoad + ewRoad, 0.0, 1.0);
}

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    float depth = - viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;

    // Terrain data
    vec4 terrainData = texture2D(uTexture, uv);
    vec3 normal = terrainData.rgb;

    // Slope
    float slope = 1.0 - abs(dot(vec3(0.0, 1.0, 0.0), normal));

    vec3 viewDirection = normalize(modelPosition.xyz - cameraPosition);
    vec3 worldNormal = normalize(mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * normal);
    vec3 viewNormal = normalize(normalMatrix * normal);

    // --- Grass color ---
    vec3 uGrassDefaultColor = vec3(0.52, 0.65, 0.26);
    vec3 uGrassShadedColor = vec3(0.52 / 1.3, 0.65 / 1.3, 0.26 / 1.3);

    float grassDistanceAttenuation = getGrassAttenuation(modelPosition.xz);
    float grassSlopeAttenuation = smoothstep(remap(slope, 0.4, 0.5, 1.0, 0.0), 0.0, 1.0);
    float grassAttenuation = grassDistanceAttenuation * grassSlopeAttenuation;
    vec3 grassColor = mix(uGrassShadedColor, uGrassDefaultColor, 1.0 - grassAttenuation);

    // --- Dirt road color ---
    // Base sandy-tan dirt like the photo
    vec3 dirtBase = vec3(0.780, 0.612, 0.388);
    // Darker dirt patches using perlin noise (mud spots)
    float dirtPatch = perlin2d(modelPosition.xz * 0.07) * 0.5 + 0.5;
    float dirtPatch2 = perlin2d(modelPosition.xz * 0.18 + vec2(43.2, 71.1)) * 0.5 + 0.5;
    // Mix patches to get variation
    vec3 dirtPatchColor = vec3(0.580, 0.435, 0.262); // darker brown
    vec3 dirtColor = mix(dirtBase, dirtPatchColor, smoothstep(0.45, 0.65, dirtPatch) * smoothstep(0.4, 0.6, dirtPatch2));

    // --- Road mask ---
    float roadMask = getRoadMask(modelPosition.xz);

    // Don't draw road on steep slopes
    roadMask *= 1.0 - smoothstep(0.15, 0.35, slope);

    // Blend grass + road
    vec3 color = mix(grassColor, dirtColor, roadMask);

    // Sun shade
    float sunShade = getSunShade(normal);
    color = getSunShadeColor(color, sunShade);

    // Sun reflection
    float sunReflection = getSunReflection(viewDirection, worldNormal, viewNormal);
    color = getSunReflectionColor(color, sunReflection);

    // Fog
    vec2 screenUv = (gl_Position.xy / gl_Position.w * 0.5) + 0.5;
    color = getFogColor(color, depth, screenUv);

    // Varyings
    vColor = color;
}