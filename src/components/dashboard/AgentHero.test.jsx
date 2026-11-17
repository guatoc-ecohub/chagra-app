// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('../../hooks/useVoiceRecorder', () => ({
    default: () => ({
        isRecording: false,
        audioLevel: 0,
        durationMs: 0,
        start: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn(),
        error: null,
    }),
}));
vi.mock('../../services/photoService', () => ({ captureAndCompress: vi.fn() }));
vi.mock('../../services/agentOutboxAttachment', () => ({ isAnalyzableImageAttachment: vi.fn() }));
vi.mock('../../store/useAgentOutboxStore', () => ({
    default: (select) => select({ send: sendMock }),
}));
vi.mock('../../store/useAssetStore', () => ({ default: (select) => select({ plants: [] }) }));
vi.mock('../../store/useAlertStore', () => ({ default: (select) => select({ activeAlerts: [] }) }));
vi.mock('../../services/agentSoundService', () => ({ agentSounds: { start: vi.fn(), listen: vi.fn() } }));
vi.mock('./AgentRedMenu', () => ({ default: () => null }));
vi.mock('../agent/capabilityRouting', () => ({ mapCapabilityPick: vi.fn() }));
vi.mock('../../data/exampleQuestions', () => ({ AGENT_HERO_CHIPS: [] }));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'biopunk' }) }));
vi.mock('../../services/userProfileService', () => ({
    getProfile: () => null,
    saveProfile: vi.fn(),
    getNotificationStyle: () => 'demo',
}));
vi.mock('../../data/cropSuggestions', () => ({ buildCropSuggestions: () => [] }));
vi.mock('../../services/syncManager', () => ({
    syncManager: {
        fetchPendingTasksFromFarmOS: vi.fn(async () => []),
        getFailedTransactions: vi.fn(async () => []),
    },
}));
vi.mock('./BotonAnarquiaGlyph', () => ({ default: () => null }));
vi.mock('../../utils/skyEphemeris', () => ({
    lunarPhase: () => ({ fraction: 0.25 }),
    solarTimes: () => null,
    moonPathD: () => '',
}));
vi.mock('../../services/climaService', () => ({
    resolveClimaLocation: () => null,
    getCachedClimaSnapshot: () => null,
}));
vi.mock('../../services/skyConditionService', () => ({
    fetchSkyConditions: vi.fn(),
    getCachedSkyConditions: () => null,
    classifySkyCondition: () => ({ condition: 'despejado', degraded: false }),
    applySensorCalibration: (condition) => condition,
}));

import AgentHero, { SEND_TRANSITION_MS } from './AgentHero.jsx';

const sendQuestion = async (container) => {
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Pregunta de prueba' } });
    await act(async () => {
        fireEvent.click(container.querySelector('.agentport-send'));
        await Promise.resolve();
        await Promise.resolve();
    });
};

const expectSendingAnimation = (container) => {
    const composer = container.querySelector('.agentport-bar');
    expect(composer.className).toContain('chagra-composer-shimmer');
    expect(composer.className).toContain('chagra-composer-sending');
    const styles = [...container.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    expect(styles).toContain('chagra-send-lift 0.52s cubic-bezier(0.22, 0.61, 0.36, 1) forwards');
};

describe('AgentHero send transition', () => {
    beforeEach(() => {
        sendMock.mockReset();
        sendMock.mockResolvedValue(undefined);
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('returns to idle and restores the scroll cue when navigation keeps the hero mounted', async () => {
        const onNavigate = vi.fn();
        const { container } = render(<AgentHero onNavigate={onNavigate} />);

        expect(container.querySelector('.agentport-scrollcue')).not.toBeNull();
        await sendQuestion(container);

        expect(SEND_TRANSITION_MS).toBe(520);
        expectSendingAnimation(container);
        expect(container.querySelector('.agentport-scrollcue')).toBeNull();
        expect(onNavigate).not.toHaveBeenCalled();

        await act(async () => { vi.advanceTimersByTime(SEND_TRANSITION_MS - 1); });
        expectSendingAnimation(container);
        expect(container.querySelector('.agentport-scrollcue')).toBeNull();
        expect(onNavigate).not.toHaveBeenCalled();

        await act(async () => { vi.advanceTimersByTime(1); });
        expect(container.querySelector('.agentport-scrollcue')).not.toBeNull();
        expect(container.querySelector('.agentport-bar').className).not.toContain('chagra-composer-sending');
        expect(onNavigate).toHaveBeenCalledOnce();
        expect(onNavigate).toHaveBeenCalledWith('agente');
    });

    it('keeps the sending animation through its full duration before navigation unmounts the hero', async () => {
        function Host() {
            const [heroVisible, setHeroVisible] = useState(true);
            return heroVisible
                ? <AgentHero onNavigate={() => setHeroVisible(false)} />
                : <div data-testid="destination" />;
        }

        const { container, queryByTestId } = render(<Host />);
        await sendQuestion(container);

        expectSendingAnimation(container);
        await act(async () => { vi.advanceTimersByTime(SEND_TRANSITION_MS - 1); });
        expectSendingAnimation(container);
        expect(queryByTestId('destination')).toBeNull();

        await act(async () => { vi.advanceTimersByTime(1); });
        expect(queryByTestId('destination')).not.toBeNull();
    });
});
