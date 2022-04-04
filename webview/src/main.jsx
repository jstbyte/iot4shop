import { render } from 'preact';
import { useEffect, useState } from 'preact/compat';
import { API_URL, POWER_MODE, POWER_STATE, usePinState } from './Store';
import './index.css';

function msToTime(ms) {
  // Pad to 2 or 3 digits, default is 2
  const pad = (n, z) => {
    z = z || 2;
    return ('00' + n).slice(-z);
  };

  let _ms = ms % 1000;
  ms = (ms - _ms) / 1000;
  let secs = ms % 60;
  ms = (ms - secs) / 60;
  let mins = ms % 60;
  let hrs = (ms - mins) / 60;

  return pad(hrs) + ':' + pad(mins) + ':' + pad(secs);
  //return pad(hrs) + ':' + pad(mins) + ':' + pad(secs) + '.' + pad(_ms, 3);
}

const PowerStatus = () => {
  const [power, setPower] = useState({
    state: 'DC',
    duration: 'loading...',
    duration_ms: -1,
  });

  const getStatus = async () => {
    setPower((_state) => ({ ..._state, duration: 'loading...' }));
    const resp = (await (await fetch(`${API_URL}power`)).text()).split(':');
    setPower({
      state: resp[0],
      duration_ms: parseInt(resp[1]),
      duration: msToTime(resp[1]),
    });
  };

  useEffect(() => {
    getStatus();

    const tickTheMS = () => {
      setPower((s) => ({
        ...s,
        duration_ms: s.duration_ms + 100,
        duration: msToTime(s.duration_ms + 100),
      }));
    };

    const tick_timer = setInterval(tickTheMS, 100);
    const update_timer = setInterval(getStatus, 30000);
    return () => {
      clearInterval(tick_timer);
      clearInterval(update_timer);
    };
  }, []);

  return (
    <div className='text-center shadow-xl card bordered'>
      <div className='flex items-center'>
        <div className='flex-1'>
          <div className='text-lg font-semibold text-warning'>Power Status</div>
          <div className='italic text-success'>{power.duration}</div>
        </div>
        <div
          className={`flex-[0.3] h-16 italic flex justify-center items-center text-2xl text-black font-bold active:opacity-50 cursor-pointer ${
            power.state == POWER_STATE.AC ? 'bg-success/50' : 'bg-error/50'
          }`}
          onClick={getStatus}>
          <img
            class='p-3'
            src={
              power.state == POWER_STATE.AC
                ? '/assets/ac.png'
                : '/assets/dc.png'
            }
          />
        </div>
      </div>
    </div>
  );
};

const FanIcon = ({ onClick, state }) => (
  <img
    className={`object-contain border border-primary rounded-full w-10 ${
      state ? 'bg-gray-500' : 'fan bg-white'
    }`}
    src='/assets/fan.png'
    alt=''
    onClick={onClick}
  />
);

const TubeLightIcon = ({ onClick, state }) => (
  <img
    class={`rounded-full p-1 border border-primary w-10 transition-all ${
      state ? 'bg-gray-500' : 'bg-white shadow-2xl shadow-pink-500 rotate-180'
    }`}
    src='/assets/bulb.png'
    onClick={onClick}
  />
);

const PlugIcon = ({ onClick, state }) => {
  return (
    <div
      class={`w-10 h-full relative rounded-full overflow-hidden border border-primary ${
        state ? 'bg-gray-500' : 'bg-white'
      }`}
      onClick={onClick}>
      <img
        className={`absolute inset-0 transition-all ${
          state
            ? '-translate-x-4 translate-y-4'
            : 'translate-x-1 -translate-y-1'
        }`}
        src='/assets/plug-male.png'
      />
      <img
        className={`absolute inset-0 transition-all ${
          state ? 'scale-150 -translate-x-2 translate-y-2' : ''
        }`}
        src='/assets/plug-female.png'
      />
    </div>
  );
};

const Switch = ({ label, handler, onSelect, View }) => {
  return (
    <div className='shadow-xl cursor-pointer card bordered'>
      <div className='flex items-center p-2 focus:bg-primary/25' tabIndex={1}>
        <div
          className='text-2xl btn btn-circle btn-xs btn-ghost'
          onClick={() => onSelect(handler?.pin)}>
          🕛
        </div>
        <label className='flex-1 text-lg italic font-semibold text-center text-warning'>
          {label}
        </label>
        <div
          className={`h-10 overflow-hidden rounded-full active:scale-95 hover:ring-2 ring-primary ${
            handler?.state ? 'shadow-black' : 'shadow-white shadow-md'
          }`}>
          <View state={handler?.state} onClick={handler?.toggle} />
        </div>
      </div>
      <div className='border-t btn-group border-primary'>
        <button
          className={`btn btn-xs flex-1 rounded-tl-none ${
            handler.powerMode == POWER_MODE.OFF ? 'btn-active' : ''
          }`}
          onClick={handler?.changePowerMode(POWER_MODE.OFF)}>
          OFF
        </button>
        <button
          className={`btn btn-xs flex-1 ${
            handler.powerMode == POWER_MODE.ON ? 'btn-active' : ''
          }`}
          onClick={handler?.changePowerMode(POWER_MODE.ON)}>
          ON
        </button>
        <button
          className={`btn btn-xs flex-1 rounded-tr-none ${
            handler.powerMode == POWER_MODE.TURBO ? 'btn-active' : ''
          }`}
          onClick={handler?.changePowerMode(POWER_MODE.TURBO)}>
          TURBO
        </button>
      </div>
    </div>
  );
};

const Uptime = ({ pin }) => {
  const [pinState, setPinState] = useState({
    state: false,
    powerMode: POWER_MODE.OFF,
    uptime: 0,
  });

  useEffect(() => {
    (async () => {
      const res = await (await fetch(`${API_URL}pin/${pin}`)).json();
      setPinState(res);
    })();
  }, []);

  const otCounteResetHandler = async () => {
    const result = await (
      await fetch(`${API_URL}reset-ot-counter/${pin}`)
    ).text();
    if (result == 'OK!') setPinState((state) => ({ ...state, uptime: 0 }));
  };

  return (
    <div class='text-center'>
      <div class='text-center font-semibold'>Total Uptime</div>
      <div class='text-4xl text-error'>{msToTime(pinState.uptime)}</div>
      <button
        onClick={otCounteResetHandler}
        class='btn btn-sm mt-4 btn-warning'>
        Reset
      </button>
    </div>
  );
};

const App = () => {
  const pins = usePinState(async () => {
    const pins = [5, 12, 13, 14];
    let serverStates = {};

    for (const pin of pins) {
      serverStates[pin] = await (await fetch(`${API_URL}pin/${pin}`)).json();
    }

    return serverStates;
  });

  const [selection, setSelection] = useState(-1);

  const onSelectHandler = (pin) => {
    setSelection((state) => (state == pin ? -1 : pin));
  };

  return (
    <div>
      <h1 className='py-4 my-4 mt-0 text-2xl font-semibold text-center capitalize text-success bg-base-200'>
        JstByte SmartHome
      </h1>

      <div className='flex flex-col max-w-xs gap-6 mx-auto'>
        <PowerStatus />

        <div className={`modal ${selection != -1 ? 'modal-open' : ''}`}>
          <div className='modal-box'>
            <label
              onClick={() => setSelection(-1)}
              for='my-modal-3'
              className='absolute btn btn-sm btn-circle right-2 top-2 btn-error'>
              ✕
            </label>
            {selection != -1 && <Uptime pin={selection} />}
          </div>
        </div>

        <Switch
          label='Ceiling Fan'
          handler={pins(13)}
          onSelect={onSelectHandler}
          View={FanIcon}
        />
        <Switch
          label='Secondary Light'
          handler={pins(14)}
          onSelect={onSelectHandler}
          View={TubeLightIcon}
        />
        <Switch
          label='Work Station'
          handler={pins(12)}
          onSelect={onSelectHandler}
          View={PlugIcon}
        />
      </div>
    </div>
  );
};

/* RENDER THE APP */
render(<App />, document.getElementById('app'));
