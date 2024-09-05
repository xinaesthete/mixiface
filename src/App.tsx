import { useEffect, useRef, useState } from 'react'
import './App.css'
import { WebMidi, type Input, type InputChannel } from 'webmidi'

type ControlChangeIdProps = { channel: number, cc: number };
type DeviceCCId = { port: InputChannel } & ControlChangeIdProps;

function CCGraph({ port, cc, channel, }: DeviceCCId) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(value);
  const graphRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    // could potentially use a string template to listen to the exact cc we want...
    // if we did some heavy TypeScript wrangling to enumerate values...
    // would maybe make sense for the library to have some more props for what to listen to
    // that'd seem useful given you often want to have something mapped to a particular control.
    // const listener = 
    port.addListener('controlchange', (e) => {
      console.log({ cc, channel }, e.controller.number, e.message.channel);
      if (e.controller.number === cc && e.message.channel === channel) {
        // console.log('graph controlchange', e);
        if (e.rawValue === undefined) {
          console.log('rawValue is undefined');
          return;
        }
        setValue(e.rawValue);
        valueRef.current = e.rawValue;
      }
    });
    return () => {
      // what is the signature of Listener if not `(e: ControlChangeEvent) => void`?
      // port.removeListener('controlchange', listener);
    }
  }, [port, cc, channel]);
  //todo improve graph rendering
  const canvasWidth = 60;
  const canvasHeight = 100;
  useEffect(() => {
    if (!graphRef.current) return;
    const ctx = graphRef.current.getContext('2d');
    if (!ctx) return; //for some reason ts isn't accepting this as a guard
    const n = 60;
    const values = new Uint8Array(n);
    let index = 0;
    let running = true;
    function update() {
      if (!running) return;
      values[index] = valueRef.current;
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = 'white';
      index = (index + 1) % n;
      for (let i = 0; i < n; i++) {
        let j = (index + i) % n;
        const w = canvasWidth/n;
        ctx.fillRect(i*w, canvasHeight, 1, -values[j]*canvasHeight/128);
      }
      requestAnimationFrame(update);
    }
    update();
    return () => {
      running = false;
    }
  }, [graphRef.current]);
  return (
    <div className='flex flex-col bg-slate-700 p-2 w-[60px]'>
      <canvas ref={graphRef} width={canvasWidth} height={canvasHeight} className='bg-slate-800 w-full h-5' />
      {cc}
    </div>
  )
}

function ChannelPane({ port } : { port: InputChannel }) {
  const channel = port.number;
  const [activeCCs, setActiveCCs] = useState<Map<string, ControlChangeIdProps>>(new Map());
  useEffect(() => {
    if (port) {
      port.addListener('noteon', (e) => {
        console.log('noteon', e);
      });
      port.addListener('noteoff', (e) => {
        console.log('noteoff', e);
      });
      port.addListener('controlchange', (e) => {
        //quite a bit of garbage for a simple midi event.
        //'human' friendly maybe, but not very 'machine' friendly...
        //or maybe I've just got delusions of grandeur / am a bit of a dick sometimes?
        //maybe the raw midi api is worth the extra effort?
        //I wonder if referances to the same object are being passed to all listeners?
        //If so, at least that reduces gc, but I wonder if they are safe from mutation?
        // e.channel = 42;
        // console.log('controlchange', e);
        const cc = e.controller.number;
        const { channel } = e.message;
        const p = { cc, channel };
        const k = `${channel}-${cc}`;
        if (activeCCs.has(k)) return;
        activeCCs.set(k, p)
        console.log(p);
        setActiveCCs(new Map(activeCCs)); //who am I to judge?
      });
    }
    return () => {
      if (port) {
        port.removeListener('noteon');
        port.removeListener('noteoff');
        port.removeListener('controlchange');
      }
    }
  }, [port]);
  return (
    <>
      <div className='outline-dashed'>
        <h2>CH {channel}</h2>
        <div className='flex flex-wrap gap-2'>
          {port && [...activeCCs].sort().map(
            ([k, p]) => (<CCGraph key={k} channel={p.channel} cc={p.cc} port={port} />)
          )}
        </div>
      </div>
    </>
  )
}

function DevicePane({ port } : { port: Input }) {
  const [activeChannels, setActiveChannels] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (port) {
      // really just want 
      port.addListener('noteon', (e) => {
        console.log('noteon', e);
      });
      port.addListener('noteoff', (e) => {
        console.log('noteoff', e);
      });
      port.addListener('controlchange', (e) => {
        const { channel } = e.message;
        if (activeChannels.has(channel)) return;
        activeChannels.add(channel);
        setActiveChannels(new Set(activeChannels));
      });
    }
    return () => {
      if (port) {
        port.removeListener('noteon');
        port.removeListener('noteoff');
        port.removeListener('controlchange');
      }
    }
  }, [port]);
  return (
    <>
      <div>
        <h2>{port.name}</h2>
        <div className='flex flex-wrap gap-2'>
          {port && [...activeChannels].sort().map(
            (channel) => (<ChannelPane key={channel} port={port.channels[channel]} />)
          )}
        </div>
      </div>
    </>
  )
}

function App() {
  const [inputs, setInputs] = useState<Input[]>([]);
  useEffect(() => {
    WebMidi.enable().then(() => {
      const handlePortsChanged = () => {
        console.log('portschanged', WebMidi.inputs);
        setInputs([...WebMidi.inputs]);
      }
      // this fires several times if there are multiple devices (e.g. mixface has 3)
      // I guess the setInputs should be batched and not a problem?
      WebMidi.addListener('portschanged', handlePortsChanged);
      //initial state
      setInputs(WebMidi.inputs);
    });
    // return () => {WebMidi.disable()};
  }, []);
  console.log('inputs', inputs);
  return (
    <>
    <div>
      {inputs.map(d => (<DevicePane key={d.name} port={d} />))}
    </div>
    </>
  )
}

export default App
