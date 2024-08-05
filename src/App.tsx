import { useEffect, useRef, useState } from 'react'
import './App.css'
import { WebMidi, type Input } from 'webmidi'

function CCGraph({ port, cc}: { port: Input, cc: number }) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(value);
  const graphRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const listener = port.addListener('controlchange', (e) => {
      if (e.controller.number === cc) {
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
  }, [port, cc]);
  const canvasWidth = 24;
  const canvasHeight = 20;
  useEffect(() => {
    if (!graphRef.current) return;
    const ctx = graphRef.current.getContext('2d');
    if (!ctx) return; //for some reason ts isn't accepting this as a guard
    // ctx.scale(1, -1);
    const n = 24;
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
    <div className='flex flex-col bg-slate-700 p-3 w-12'>
      <canvas ref={graphRef} width={canvasWidth} height={canvasHeight} className='bg-slate-800 w-6 h-5' />
      {cc} 
      <div className='h-[100px]'>
        <div className='bg-white' style={{height: `${value*80/128}px`}} />
      </div>
    </div>
  )
}


function App() {
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [selectedInput, setSelectedInput] = useState<Input>();
  const [activeCCs, setActiveCCs] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (pendingRefresh) {
      setSelectedInput(undefined);
      setActiveCCs(new Set());
      setInputs([]);
      WebMidi.enable().then(() => {
        setInputs(WebMidi.inputs);
        setPendingRefresh(false);
      });
    }
    // return () => {WebMidi.disable()};
  }, [pendingRefresh]);
  useEffect(() => {
    if (selectedInput) {
      selectedInput.addListener('noteon', (e) => {
        console.log('noteon', e);
      });
      selectedInput.addListener('noteoff', (e) => {
        console.log('noteoff', e);
      });
      selectedInput.addListener('controlchange', (e) => {
        //quite a bit of garbage for a simple midi event.
        //'human' friendly maybe, but not very 'machine' friendly...
        //or maybe I've just got delusions of grandeur / am a bit of a dick sometimes?
        //maybe the raw midi api is worth the extra effort?
        //I wonder if referances to the same object are being passed to all listeners?
        //If so, at least that reduces gc, but I wonder if they are safe from mutation?
        e.channel = 42;
        console.log('controlchange', e);
        activeCCs.add(e.controller.number);
        setActiveCCs(new Set(activeCCs)); //who am I to judge?
      });
    }
    return () => {
      if (selectedInput) {
        selectedInput.removeListener('noteon');
        selectedInput.removeListener('noteoff');
        selectedInput.removeListener('controlchange');
      }
    }
  }, [selectedInput]);
  return (
    <>
    <div>
      <select onChange={e => setSelectedInput(inputs.find(i => i.name === e.currentTarget.value))}>
        {inputs.map((input) => (
          <option key={input.id}>{input.name}</option>
        ))}
      </select>
      <button onClick={() => setPendingRefresh(true)}>Refresh</button>
      <div className='flex flex-wrap gap-2'>
        {selectedInput && [...activeCCs].sort((a, b) => a-b).map(cc => (<CCGraph key={cc} port={selectedInput} cc={cc} />))}
      </div>
    </div>
    </>
  )
}

export default App
