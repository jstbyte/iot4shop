import { createContext, render } from 'preact';
import { useEffect, useState } from 'preact/compat';
import { POWER_MODE, POWER_STATE, usePinState } from './Store';
import './index.css';

const API_URL = 'http://192.168.43.153/';

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
            power.state == POWER_STATE.AC ? 'bg-success' : 'bg-error'
          }`}
          onClick={getStatus}>
          {power.state}
        </div>
      </div>
    </div>
  );
};

const Button = ({ label, handler }) => {
  return (
    <div className='shadow-xl card bordered'>
      <div className='flex items-center p-2'>
        <label className='flex-1 text-lg italic font-semibold text-center text-warning'>
          {label}
        </label>
        <input
          type='checkbox'
          className='toggle toggle-primary checkbox-primary toggle-lg'
          onChange={handler?.toggle}
          checked={!handler?.state}
        />
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

const App = () => {
  const pins = usePinState(async () => {
    const pins = [5, 12, 13, 14];
    let serverStates = {};

    for (const pin of pins) {
      const state =
        (await (await fetch(`${API_URL}pin/${pin}`)).text()) == 'high';

      const powerMode = await (
        await fetch(`${API_URL}power-saver/${pin}`)
      ).text();

      serverStates[pin] = { state, powerMode };
    }

    return serverStates;
  });

  return (
    <div>
      <h1 className='py-4 my-4 mt-0 text-2xl font-semibold text-center capitalize text-success bg-base-200'>
        JstByte SmartHome
      </h1>
      <div className='flex flex-col max-w-xs gap-6 mx-auto'>
        <PowerStatus />
        <Button label='Tube Light' handler={pins(5)} />
        <Button label='Secondary Light' handler={pins(13)} />
        <Button label='Ceiling Fan' handler={pins(14)} />
        <Button label='Work Station' handler={pins(12)} />
      </div>
    </div>
  );
};

/* RENDER THE APP */
render(<App />, document.getElementById('app'));
