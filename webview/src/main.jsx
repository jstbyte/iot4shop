import { render } from 'preact';
import { useEffect, useState } from 'react';
import './index.css';

const API_URL = '/';

const POWER_MODE = {
  OFF: 'off',
  ON: 'on',
  TURBO: 'turbo',
};

const POWER_STATE = {
  DC: 'DC',
  AC: 'AC',
};

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

const getRelativeTime = (time_ms) => {
  // Convert to a positive integer
  const time = Math.abs(time_ms);

  // Define humanTime and units
  let humanTime, units;

  // If there are years
  if (time > 1000 * 60 * 60 * 24 * 365) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24 * 365), 10);
    units = 'years';
  }

  // If there are months
  else if (time > 1000 * 60 * 60 * 24 * 30) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24 * 30), 10);
    units = 'months';
  }

  // If there are weeks
  else if (time > 1000 * 60 * 60 * 24 * 7) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24 * 7), 10);
    units = 'weeks';
  }

  // If there are days
  else if (time > 1000 * 60 * 60 * 24) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24), 10);
    units = 'days';
  }

  // If there are hours
  else if (time > 1000 * 60 * 60) {
    humanTime = parseInt(time / (1000 * 60 * 60), 10);
    units = 'hours';
  }

  // If there are minutes
  else if (time > 1000 * 60) {
    humanTime = parseInt(time / (1000 * 60), 10);
    units = 'minutes';
  }

  // Otherwise, use seconds
  else {
    humanTime = parseInt(time / 1000, 10);
    units = 'seconds';
  }

  return humanTime + ' ' + units;
};

const PowerStatus = () => {
  const [power, setPower] = useState({ state: 'DC', duration: 'loading...' });

  const getStatus = async () => {
    setPower((_state) => ({ ..._state, duration: 'loading...' }));
    const resp = await (
      await (await fetch(`${API_URL}power`)).text()
    ).split(':');
    setPower({ state: resp[0], duration: msToTime(resp[1]) });
  };

  useEffect(() => {
    getStatus();
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

const Button = ({ pin, label }) => {
  const [state, setState] = useState(false);
  const [powerMode, setPowerMode] = useState(POWER_MODE.OFF);

  const toggle = async () => {
    const resp = await (await fetch(`${API_URL}pin/${pin}/change`)).text();
    setState(resp == 'high');
  };

  const togglePowerMode = (mode) => async () => {
    if (mode == powerMode) return;
    const resp = await (
      await fetch(`${API_URL}power-saver/${pin}/${mode}`)
    ).text();

    setPowerMode(resp);
  };

  const getCurrentState = async () => {
    const currentState = await (await fetch(`${API_URL}pin/${pin}`)).text();

    const powerMode = await (
      await fetch(`${API_URL}power-saver/${pin}`)
    ).text();

    setState(currentState == 'high');
    setPowerMode(powerMode);
  };

  useEffect(getCurrentState, []);

  return (
    <div className='shadow-xl card bordered'>
      <div className='flex items-center p-2'>
        <label className='flex-1 text-lg italic font-semibold text-center text-warning'>
          {label}
        </label>
        <input
          type='checkbox'
          className='toggle toggle-primary checkbox-primary toggle-lg'
          onChange={toggle}
          checked={!state}
        />
      </div>
      <div className='border-t btn-group border-primary'>
        <button
          className={`btn btn-xs flex-1 rounded-tl-none ${
            powerMode == POWER_MODE.OFF ? 'btn-active' : ''
          }`}
          onClick={togglePowerMode(POWER_MODE.OFF)}>
          OFF
        </button>
        <button
          className={`btn btn-xs flex-1 ${
            powerMode == POWER_MODE.ON ? 'btn-active' : ''
          }`}
          onClick={togglePowerMode(POWER_MODE.ON)}>
          ON
        </button>
        <button
          className={`btn btn-xs flex-1 rounded-tr-none ${
            powerMode == POWER_MODE.TURBO ? 'btn-active' : ''
          }`}
          onClick={togglePowerMode(POWER_MODE.TURBO)}>
          TURBO
        </button>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div>
      <h1 className='py-4 my-4 mt-0 text-2xl font-semibold text-center capitalize text-success bg-base-200'>
        JstByte SmartHome
      </h1>
      <div className='flex flex-col max-w-xs gap-6 mx-auto'>
        <PowerStatus />
        <Button pin={5} label='Tube Light' />
        <Button pin={13} label='Secondary Light' />
        <Button pin={12} label='Fan' />
        <Button pin={14} label='Empty!' />
      </div>
    </div>
  );
};

/* RENDER THE APP */
render(<App />, document.getElementById('app'));
