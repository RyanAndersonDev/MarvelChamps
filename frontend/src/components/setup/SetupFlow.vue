<script setup lang="ts">
import { useSetupStore } from '../../stores/setupStore';
import StepHero     from './StepHero.vue';
import StepAspect   from './StepAspect.vue';
import StepVillain  from './StepVillain.vue';
import StepEncounter from './StepEncounter.vue';

const setup = useSetupStore();

const STEP_LABELS = ['Hero', 'Deck', 'Villain', 'Encounter'];
</script>

<template>
    <div class="setup-screen">
        <!-- Step indicator -->
        <header class="setup-header">
            <div class="step-indicator">
                <div
                    v-for="(label, i) in STEP_LABELS"
                    :key="i"
                    class="step-pip"
                    :class="{
                        active:    setup.currentStep === i + 1,
                        completed: setup.currentStep > i + 1,
                    }"
                >
                    <span class="pip-num">{{ i + 1 }}</span>
                    <span class="pip-label">{{ label }}</span>
                </div>
            </div>
        </header>

        <!-- Step content -->
        <main class="setup-content">
            <Transition name="step" mode="out-in">
                <StepHero      v-if="setup.currentStep === 1" key="hero" />
                <StepAspect    v-else-if="setup.currentStep === 2" key="aspect" />
                <StepVillain   v-else-if="setup.currentStep === 3" key="villain" />
                <StepEncounter v-else-if="setup.currentStep === 4" key="encounter" />
            </Transition>
        </main>

        <!-- Navigation -->
        <footer class="setup-footer">
            <button
                class="btn-nav btn-back"
                :disabled="setup.currentStep === 1"
                @click="setup.prevStep()"
            >
                ← Back
            </button>

            <button
                v-if="setup.currentStep < 4"
                class="btn-nav btn-next"
                :disabled="!setup.canAdvance"
                @click="setup.nextStep()"
            >
                Next →
            </button>

            <button
                v-else
                class="btn-nav btn-launch"
                :disabled="!setup.canAdvance"
                @click="setup.launchGame()"
            >
                Launch Game
            </button>
        </footer>
    </div>
</template>

<style scoped>
.setup-screen {
    width: 100vw;
    height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background: #0d0d0d;
    color: white;
}

/* Header */
.setup-header {
    padding: 24px 32px 0;
    display: flex;
    justify-content: center;
}

.step-indicator {
    display: flex;
    align-items: center;
    gap: 0;
}

.step-pip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    position: relative;
    color: rgba(255,255,255,0.25);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    transition: color 0.2s;
}

.step-pip::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 1px;
    height: 20px;
    background: rgba(255,255,255,0.1);
}

.step-pip:last-child::after { display: none; }

.step-pip.active    { color: rgba(255,255,255,0.9); }
.step-pip.completed { color: rgba(255,255,255,0.45); }

.pip-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    transition: background 0.2s;
}

.step-pip.active    .pip-num { background: #e8c84a; color: #111; }
.step-pip.completed .pip-num { background: rgba(232,200,74,0.3); }

/* Content */
.setup-content {
    display: flex;
    align-items: stretch;
    padding: 24px 40px;
    overflow-y: auto;
    min-height: 0;
}

/* Footer */
.setup-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 32px;
    border-top: 1px solid rgba(255,255,255,0.07);
}

.btn-nav {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.8);
    padding: 14px 36px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.03em;
}

.btn-nav:hover:not(:disabled) {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.28);
}

.btn-nav:disabled { opacity: 0.25; cursor: default; }

.btn-launch {
    background: rgba(232, 200, 74, 0.15);
    border-color: #e8c84a;
    color: #e8c84a;
}

.btn-launch:hover:not(:disabled) {
    background: rgba(232, 200, 74, 0.25);
}

/* Step transitions */
.step-enter-active, .step-leave-active { transition: opacity 0.15s, transform 0.15s; }
.step-enter-from  { opacity: 0; transform: translateX(16px); }
.step-leave-to    { opacity: 0; transform: translateX(-16px); }

/* Ensure step components fill the content area */
.setup-content > * { width: 100%; }
</style>
