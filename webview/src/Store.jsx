import { useEffect, useState } from 'preact/hooks';

export const API_URL = '/';

export const POWER_MODE = {
  OFF: 'off',
  ON: 'on',
  TURBO: 'turbo',
};

export const POWER_STATE = {
  DC: 'DC',
  AC: 'AC',
};

export const usePinState = (getInitialStates) => {
  const [pinStates, setPinStates] = useState({
    5: {
      state: true,
      powerMode: POWER_MODE.OFF,
      uptime: 0,
    },
    12: {
      state: true,
      powerMode: POWER_MODE.OFF,
      uptime: 0,
    },
    13: {
      state: true,
      powerMode: POWER_MODE.OFF,
      uptime: 0,
    },
    14: {
      state: true,
      powerMode: POWER_MODE.OFF,
      uptime: 0,
    },
  });

  const togglePin = async (pin) => {
    const resp = await (await fetch(`${API_URL}pin/${pin}/change`)).text();

    setPinStates((state) => ({
      ...state,
      [pin]: { ...state[pin], state: resp == 'high' },
    }));
  };

  const changePowerMode = async (pin, powerMode) => {
    if (pinStates[pin].powerMode == powerMode) return;
    const resp = await (
      await fetch(`${API_URL}power-saver/${pin}/${powerMode}`)
    ).text();

    setPinStates((state) => ({
      ...state,
      [pin]: { ...state[pin], powerMode: resp },
    }));
  };

  // TODO: Fix : Can't call "this.forceUpdate" on an unmounted component.
  useEffect(async () => {
    const initialStates = await getInitialStates();
    if (!initialStates) return;
    setPinStates((state) => ({ ...state, ...initialStates }));
  }, []);

  return (pin) => ({
    pin,
    pinStates,
    setPinStates,
    state: pinStates[pin].state,
    powerMode: pinStates[pin].powerMode,
    uptime: pinStates[pin].uptime,
    toggle: () => togglePin(pin),
    changePowerMode: (powerMode) => () => changePowerMode(pin, powerMode),
  });
};
