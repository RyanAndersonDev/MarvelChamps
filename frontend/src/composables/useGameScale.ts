import { ref, computed, onMounted, onUnmounted } from 'vue'

// The CSS viewport width (px) at which scale = 1.0.
// Derived from: game looks good at 75% browser zoom on a 1920px screen
//   → 1920 / 0.75 = 2560px effective CSS viewport.
// Increase this value if things still look too large; decrease if too small.
const DESIGN_WIDTH = 2560
const MIN_SCALE = 0.6

export function useGameScale() {
    const viewportWidth = ref(window.innerWidth)
    const onResize = () => { viewportWidth.value = window.innerWidth }
    onMounted(() => window.addEventListener('resize', onResize))
    onUnmounted(() => window.removeEventListener('resize', onResize))

    const gameScale = computed(() =>
        Math.max(MIN_SCALE, Math.min(1.0, viewportWidth.value / DESIGN_WIDTH))
    )

    const scaleStyle = computed(() => {
        const s = gameScale.value
        return {
            transform: `scale(${s})`,
            transformOrigin: 'top left',
            width: `${(100 / s).toFixed(3)}vw`,
            height: `${(100 / s).toFixed(3)}vh`,
        }
    })

    return { gameScale, scaleStyle }
}
