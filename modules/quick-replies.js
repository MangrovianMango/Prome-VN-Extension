import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { extensionName } from '../constants.js';

const ACTIVE_CLASS = 'prome-limit-quick-replies';
const HEIGHT_PROPERTY = '--prome-quick-replies-height';
const mobileLayout = window.matchMedia('(max-width: 1000px)');
let frame = null;
let currentBar = null;
let barObserver = null;
let resizeObserver = null;
let initialized = false;

function rowCount(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(6, Math.max(1, Math.round(number))) : fallback;
}

function settings() {
    return extension_settings[extensionName];
}

function scheduleLayout() {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
        frame = null;
        applyQuickReplyLayout();
    });
}

function observeBar(bar) {
    if (bar === currentBar) return;
    barObserver?.disconnect();
    resizeObserver?.disconnect();
    currentBar = bar;
    if (!bar) return;
    barObserver ??= new MutationObserver(scheduleLayout);
    barObserver.observe(bar, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver ??= new ResizeObserver(scheduleLayout);
        resizeObserver.observe(bar);
    }
}

export function applyQuickReplyLayout() {
    const config = settings();
    const bar = document.getElementById('qr--bar');
    observeBar(bar);
    const active = Boolean(config?.limitQuickReplyRows !== false && config &&
        document.body.classList.contains('waifuMode'));
    document.body.classList.toggle(ACTIVE_CLASS, active);
    if (!active || !bar) {
        document.documentElement.style.removeProperty(HEIGHT_PROPERTY);
        return;
    }

    const rows = mobileLayout.matches
        ? rowCount(config.quickReplyRowsMobile, 1)
        : rowCount(config.quickReplyRowsDesktop, 2);
    // Measure the active theme/font instead of assuming a fixed button height.
    let rowHeight = 0;
    for (const button of bar.querySelectorAll('.qr--button')) {
        const rect = button.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const style = getComputedStyle(button);
        const outerHeight = rect.height + (parseFloat(style.marginTop) || 0) +
            (parseFloat(style.marginBottom) || 0);
        rowHeight = Math.max(rowHeight, outerHeight);
    }
    if (!rowHeight) rowHeight = 36;
    let gap = 0;
    for (const container of bar.querySelectorAll('.qr--buttons')) {
        gap = Math.max(gap, parseFloat(getComputedStyle(container).rowGap) || 0);
    }
    const style = getComputedStyle(bar);
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) +
        (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const height = `${Math.ceil(rows * rowHeight + (rows - 1) * gap + padding)}px`;
    const rootStyle = document.documentElement.style;
    if (rootStyle.getPropertyValue(HEIGHT_PROPERTY) !== height) {
        rootStyle.setProperty(HEIGHT_PROPERTY, height);
    }
}

export function setupQuickReplyLayout() {
    if (initialized) return;
    initialized = true;
    const config = settings();
    config.quickReplyRowsDesktop = rowCount(config.quickReplyRowsDesktop, 2);
    config.quickReplyRowsMobile = rowCount(config.quickReplyRowsMobile, 1);
    const enabled = document.getElementById('prome-limit-quick-replies');
    enabled.checked = config.limitQuickReplyRows !== false;
    enabled.addEventListener('change', () => {
        config.limitQuickReplyRows = enabled.checked;
        saveSettingsDebounced();
        scheduleLayout();
    });
    for (const [id, key] of [
        ['prome-quick-reply-desktop', 'quickReplyRowsDesktop'],
        ['prome-quick-reply-mobile', 'quickReplyRowsMobile'],
    ]) {
        const control = document.getElementById(id);
        const output = document.getElementById(`${id}-value`);
        control.value = config[key];
        output.textContent = config[key];
        control.addEventListener('input', () => {
            config[key] = rowCount(control.value, key === 'quickReplyRowsMobile' ? 1 : 2);
            output.textContent = config[key];
            saveSettingsDebounced();
            scheduleLayout();
        });
    }
    // Theme/VN changes and a replaced Quick Reply bar need no page reload.
    new MutationObserver(scheduleLayout).observe(document.body, {
        attributes: true, attributeFilter: ['class'],
    });
    new MutationObserver(() => {
        if (document.getElementById('qr--bar') !== currentBar) scheduleLayout();
    }).observe(document.body, { childList: true, subtree: true });
    if (mobileLayout.addEventListener) mobileLayout.addEventListener('change', scheduleLayout);
    else mobileLayout.addListener(scheduleLayout);
    window.addEventListener('resize', scheduleLayout);
    window.visualViewport?.addEventListener('resize', scheduleLayout);
    document.fonts?.ready.then(scheduleLayout);
    applyQuickReplyLayout();
}
