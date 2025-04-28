const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'interactive',
    sampleRate: 44100
  });
  
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const source = audioCtx.createMediaStreamSource(stream);
  
      let boost = createBoost(audioCtx, 1.5);
      let distortion = createDistortion(audioCtx, 300);
      const delay = createDelay(audioCtx, 0.4);
  
      let reverb;
      let isBoostOn = true, isDistortionOn = true, isDelayOn = true, isReverbOn = true;
  
      createReverb(audioCtx, './sound/hall.wav').then(result => {
        reverb = result;
  
        function updateChain() {
          // Disconnect all nodes
          source.disconnect();
          boost.disconnect();
          distortion.disconnect();
          
          delay.input.disconnect();
          delay.output.disconnect();
          
          delay.feedbackNode.disconnect();
          delay.wetGain.disconnect();
          delay.dryGain.disconnect();
          
          if (reverb) reverb.disconnect();
  
          let node = source;
  
          if (isBoostOn) {
            node.connect(boost);
            node = boost;
          }
  
          if (isDistortionOn) {
            node.connect(distortion);
            node = distortion;
          }
  
          if (isDelayOn) {
            node.connect(delay.input);
            delay.input.connect(delay.delayNode);  // Delay input to delay node
            delay.delayNode.connect(delay.feedbackNode);  // Delay node to feedback loop
            delay.feedbackNode.connect(delay.delayNode);  // Feedback loop to delay node
            delay.delayNode.connect(delay.wetGain);  // Delay node to wet gain
            delay.wetGain.connect(delay.output);  // Wet gain to output
            delay.output.connect(delay.dryGain);  // Dry mix to output
            node = delay.output;
          }
  
          if (isReverbOn && reverb) {
            node.connect(reverb);
            node = reverb;
          }
  
          node.connect(audioCtx.destination);  // Output to speakers
        }
  
        // === UI Interactions ===
        document.getElementById('boostGain').addEventListener('input', e => {
          const val = parseFloat(e.target.value);
          boost.gain.value = val;
          document.getElementById('boostValue').textContent = val.toFixed(2);
        });
  
        document.getElementById('distortionAmount').addEventListener('input', e => {
          const val = parseFloat(e.target.value);
          distortion = createDistortion(audioCtx, val);
          document.getElementById('distortionValue').textContent = val;
          updateChain();
        });
  
        document.getElementById('delayTime').addEventListener('input', e => {
          const val = parseFloat(e.target.value);
          delay.delayNode.delayTime.value = val;
          document.getElementById('delayValue').textContent = val.toFixed(2);
        });
        
        document.getElementById('delayFeedback').addEventListener('input', e => {
          const val = parseFloat(e.target.value);
          delay.feedbackNode.gain.value = val;
          document.getElementById('delayFeedbackValue').textContent = val.toFixed(2);
        });
        
        document.getElementById('delayMix').addEventListener('input', e => {
          const val = parseFloat(e.target.value);
          delay.wetGain.gain.value = val;
          delay.dryGain.gain.value = 1 - val;
          document.getElementById('delayMixValue').textContent = val.toFixed(2);
        });
  
  
        // Toggle buttons
        document.getElementById('boostToggle').addEventListener('click', () => {
          isBoostOn = !isBoostOn;
          updateChain();
        });
  
        document.getElementById('distortionToggle').addEventListener('click', () => {
          isDistortionOn = !isDistortionOn;
          updateChain();
        });
  
        document.getElementById('delayToggle').addEventListener('click', () => {
          isDelayOn = !isDelayOn;
          updateChain();
        });
  
        document.getElementById('reverbToggle').addEventListener('click', () => {
          isReverbOn = !isReverbOn;
          updateChain();
        });
  
        updateChain(); // Run once to initialize the signal path
      }).catch(err => {
        console.error('Error loading reverb:', err);
      });
    })
    .catch(err => {
      console.error('Mic access error:', err);
      alert('⚠️ Please allow access to your microphone or audio input device.');
    });
  
  // === Pedals ===
  
  function createBoost(audioCtx, gainValue = 2) {
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = gainValue;
    return gainNode;
  }
  
  function createDistortion(audioCtx, amount = 400) {
    const distortion = audioCtx.createWaveShaper();
    function makeDistortionCurve(amount) {
      const k = typeof amount === 'number' ? amount : 50,
            n_samples = 44100,
            curve = new Float32Array(n_samples),
            deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }
    distortion.curve = makeDistortionCurve(amount);
    distortion.oversample = '4x';
    return distortion;
  }
  
  function createDelay(audioCtx, delayTime = 0.4, feedbackAmount = 0.5, mixAmount = 0.5) {
    const input = audioCtx.createGain();
    const output = audioCtx.createGain();
    const delay = audioCtx.createDelay();
    const feedback = audioCtx.createGain();
    const wet = audioCtx.createGain();
    const dry = audioCtx.createGain();
  
    delay.delayTime.value = delayTime;
    feedback.gain.value = feedbackAmount;
    wet.gain.value = mixAmount;
    dry.gain.value = 1 - mixAmount;
  
    input.connect(dry);
    dry.connect(output);
  
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay); // Feedback loop
    delay.connect(wet);
    wet.connect(output);
  
    return {
      input,
      output,
      delayNode: delay,
      feedbackNode: feedback,
      wetGain: wet,
      dryGain: dry
    };
  }
  
  async function createReverb(audioCtx, url = './sound/hall.wav') {
    const convolver = audioCtx.createConvolver();
  
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
    convolver.buffer = audioBuffer;
    return convolver;
  }
  