// monitor.js

document.addEventListener("DOMContentLoaded", function() {
    const container = d3.select("#monitor-container");
  
    // Define your vital signs (6 rows) with label, color, and unit.
    const vitals = [
      { key: "Solar8000/HR",         label: "HR",    color: "#0f0",    unit: "bpm" },
      { key: "Solar8000/ART_SBP",    label: "SBP",   color: "#f00",    unit: "mmHg" },
      { key: "Solar8000/ART_MBP",    label: "MBP",   color: "#ffa500", unit: "mmHg" },
      { key: "Solar8000/ART_DBP",    label: "DBP",   color: "#ff0",    unit: "mmHg" },
      { key: "Solar8000/ETCO2",      label: "ETCO2", color: "#0ff",    unit: "mmHg" },
      { key: "Solar8000/PLETH_SPO2", label: "SpO2",  color: "#f0f",    unit: "%" }
    ];
  
    // Scrolling speed in pixels per second
    const speed = 50;
  
    // Stretch factor to spread out the waveform horizontally
    const stretchFactor = 15;
  
    // Duration (ms) to bridge from the last data point to the first
    const bridgeMs = 2000;
  
    // Flash threshold: if instantaneous change >= 3% from previous tick, show red border
    const flashThreshold = 0.03; // 3%
  
    // Load "Death" (non-survivor) data
    d3.json("vital_signs_data.json").then(data => {
      const rawDeath = data["Death"].flat();
  
      vitals.forEach((v, rowIndex) => {
        // Create the row container
        const row = container.append("div")
          .attr("class", "vital-row");
  
        // Left side: wave container (~85% width)
        const waveCont = row.append("div")
          .attr("class", "wave-container");
  
        // Right side: readout container (~15% width)
        const readoutCont = row.append("div")
          .attr("class", "readout-container");
  
        // Add a label
        readoutCont.append("div")
          .attr("class", "readout-label")
          .text(v.label);
  
        // Add the numeric readout (number + unit)
        const valueEl = readoutCont.append("div")
          .attr("class", "readout-value")
          .style("color", v.color)
          .html("<span class='readout-number'>--</span> <span class='readout-unit'>" + v.unit + "</span>");
  
        // Delay so waveCont has size
        setTimeout(() => {
          const waveWidth = waveCont.node().clientWidth;
          const waveHeight = waveCont.node().clientHeight;
          const extendedWidth = waveWidth * stretchFactor;
  
          // Create the SVG
          const svg = waveCont.append("svg")
            .attr("class", "wave-svg")
            .attr("width", waveWidth)
            .attr("height", waveHeight);
  
          // 1) Define a pattern for the grid that draws vertical & horizontal lines
          const defs = svg.append("defs");
          const patternSize = 20; // adjust for denser or sparser lines
          const gridPattern = defs.append("pattern")
            .attr("id", "monitorGrid" + rowIndex)
            .attr("width", patternSize)
            .attr("height", patternSize)
            .attr("patternUnits", "userSpaceOnUse");
  
          // Draw a cross in the pattern cell (vertical + horizontal lines)
          gridPattern.append("path")
            .attr("d", `M 0 0 L 0 ${patternSize} M 0 0 L ${patternSize} 0`)
            .attr("fill", "none")
            .attr("stroke", "rgba(0,255,0,0.2)")
            .attr("stroke-width", 1);
  
          // 2) A rect that covers the entire container with the grid pattern
          svg.append("rect")
            .attr("width", waveWidth)
            .attr("height", waveHeight)
            .attr("fill", `url(#monitorGrid${rowIndex})`);
  
          // Prepare the data for this vital
          let arr = rawDeath.map(d => ({
            time: new Date(d.Time),
            value: +d[v.key]
          })).filter(d => !isNaN(d.value));
          arr.sort((a, b) => a.time - b.time);
          if (!arr.length) return;
  
          // Bridge: add a final point that matches the first value for a smooth loop
          const firstVal = arr[0].value;
          const lastTime = arr[arr.length - 1].time.getTime();
          const bridgingTime = new Date(lastTime + bridgeMs);
          arr.push({ time: bridgingTime, value: firstVal });
  
          // X scale across [0..extendedWidth]
          const timeExtent = [arr[0].time, bridgingTime];
          const x = d3.scaleTime()
            .domain(timeExtent)
            .range([0, extendedWidth]);
  
          // Y scale (with padding)
          const valExtent = d3.extent(arr, d => d.value);
          const pad = (valExtent[1] - valExtent[0]) * 0.1;
          const yMin = valExtent[0] - pad;
          const yMax = valExtent[1] + pad;
          const y = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([waveHeight - 10, 10]);
  
          // Line generator
          const line = d3.line()
            .x(d => x(d.time))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);
  
          // Group for the waveform copies
          const g = svg.append("g").attr("class", "line-group");
  
          // Main path
          const path = g.append("path")
            .datum(arr)
            .attr("class", "wave-line")
            .attr("stroke", v.color)
            .attr("d", line);
  
          // Duplicate path for wrap-around
          const duplicate = path.node().cloneNode(true);
          g.node().appendChild(duplicate);
          duplicate.setAttribute("transform", `translate(${extendedWidth},0)`);
  
          // For interpolating the current value
          const bisect = d3.bisector(d => d.time).left;
          let lastValue; // store previous tick's value
  
          // Timer for continuous scrolling + readout updates
          d3.timer(elapsed => {
            // Horizontal translation
            let dx = (elapsed / 1000) * speed;
            dx = dx % extendedWidth;
            g.attr("transform", `translate(${-dx},0)`);
  
            // The “current” x coordinate at the right edge
            const currentX = (waveWidth + dx) % extendedWidth;
            const currentTime = x.invert(currentX);
  
            // Find the data index
            const i = bisect(arr, currentTime);
            let currentVal;
            if (i <= 0) {
              currentVal = arr[0].value;
            } else if (i >= arr.length) {
              currentVal = arr[arr.length - 1].value;
            } else {
              const d0 = arr[i - 1], d1 = arr[i];
              const t0 = d0.time.getTime(), t1 = d1.time.getTime();
              const ratio = (currentTime.getTime() - t0) / (t1 - t0);
              currentVal = d0.value + ratio * (d1.value - d0.value);
            }
  
            // Compare to lastValue to detect a spike/dip
            if (lastValue !== undefined) {
              const relChange = Math.abs(currentVal - lastValue) / Math.abs(lastValue);
              if (relChange >= flashThreshold) {
                // Instead of flashing the whole row, add a red border to the readout container
                if (!readoutCont.classed("border-flash")) {
                  readoutCont.classed("border-flash", true);
                  setTimeout(() => readoutCont.classed("border-flash", false), 500);
                }
              }
            }
            lastValue = currentVal;
  
            // Update the numeric readout
            valueEl.html("<span class='readout-number'>" + currentVal.toFixed(0) + "</span> <span class='readout-unit'>" + v.unit + "</span>");
          });
        }, 50);
      });
    })
    .catch(err => {
      console.error("Error loading data:", err);
      container.append("div")
        .style("color", "#f00")
        .style("text-align", "center")
        .style("margin-top", "20px")
        .text("Failed to load vital_signs_data.json");
    });
  });
  