// monitor.js

document.addEventListener("DOMContentLoaded", function() {
    const container = d3.select("#monitor-container");
  
    // Define your vital signs with key, label, color, and unit.
    const vitals = [
      { key: "Solar8000/HR",         label: "HR",    color: "#0f0",    unit: "bpm" },
      { key: "Solar8000/ART_SBP",      label: "SBP",   color: "#f00",    unit: "mmHg" },
      { key: "Solar8000/ART_MBP",      label: "MBP",   color: "#ffa500", unit: "mmHg" },
      { key: "Solar8000/ART_DBP",      label: "DBP",   color: "#ff0",    unit: "mmHg" },
      { key: "Solar8000/ETCO2",        label: "ETCO2", color: "#0ff",    unit: "mmHg" },
      { key: "Solar8000/PLETH_SPO2",   label: "SpO2",  color: "#f0f",    unit: "%" }
    ];
  
    // Scrolling speed in pixels per second
    const speed = 50;
    // Stretch factor to spread out the waveform horizontally
    const stretchFactor = 15;
    // Duration (ms) to bridge from the last data point to the first
    const bridgeMs = 2000;
    // Flash threshold: if instantaneous change >= 3% from previous tick, flash the readout container.
    const flashThreshold = 0.03; // 3%
  
    // Load non-survivor ("Death") data
    d3.json("vital_signs_data.json").then(data => {
      const rawDeath = data["Death"].flat();
  
      vitals.forEach((v, rowIndex) => {
        // Create the row container and assign an ID for later selection.
        const row = container.append("div")
          .attr("class", "vital-row")
          .attr("id", v.key + "-row");
  
        // Left side: wave container (85% width)
        const waveCont = row.append("div")
          .attr("class", "wave-container");
  
        // Right side: readout container (15% width)
        const readoutCont = row.append("div")
          .attr("class", "readout-container");
  
        // Add the vital label
        readoutCont.append("div")
          .attr("class", "readout-label")
          .text(v.label);
  
        // Add the numeric readout (number + unit)
        const valueEl = readoutCont.append("div")
          .attr("class", "readout-value")
          .style("color", v.color)
          .html("<span class='readout-number'>--</span> <span class='readout-unit'>" + v.unit + "</span>");
  
        // Delay so that waveCont has computed dimensions
        setTimeout(() => {
          const waveWidth = waveCont.node().clientWidth;
          const waveHeight = waveCont.node().clientHeight;
          const extendedWidth = waveWidth * stretchFactor;
  
          // Create the SVG inside the wave container
          const svg = waveCont.append("svg")
            .attr("class", "wave-svg")
            .attr("width", waveWidth)
            .attr("height", waveHeight);
  
          // Define a grid pattern that covers the entire container
          const defs = svg.append("defs");
          const patternSize = 20;
          const gridPattern = defs.append("pattern")
            .attr("id", "monitorGrid" + rowIndex)
            .attr("width", patternSize)
            .attr("height", patternSize)
            .attr("patternUnits", "userSpaceOnUse");
          gridPattern.append("path")
            .attr("d", `M 0 0 L 0 ${patternSize} M 0 0 L ${patternSize} 0`)
            .attr("fill", "none")
            .attr("stroke", "rgba(0,255,0,0.2)")
            .attr("stroke-width", 1);
  
          // Add a rect that fills the entire SVG with the grid pattern
          svg.append("rect")
            .attr("width", waveWidth)
            .attr("height", waveHeight)
            .attr("fill", `url(#monitorGrid${rowIndex})`);
  
          // Prepare data for this vital sign
          let arr = rawDeath.map(d => ({
            time: new Date(d.Time),
            value: +d[v.key]
          })).filter(d => !isNaN(d.value));
          arr.sort((a, b) => a.time - b.time);
          if (!arr.length) return;
  
          // Bridge: add an extra point so the line smoothly connects from the last to the first value.
          const firstVal = arr[0].value;
          const lastTime = arr[arr.length - 1].time.getTime();
          const bridgingTime = new Date(lastTime + bridgeMs);
          arr.push({ time: bridgingTime, value: firstVal });
  
          // Define time domain and create x scale across extendedWidth
          const timeExtent = [arr[0].time, bridgingTime];
          const x = d3.scaleTime()
            .domain(timeExtent)
            .range([0, extendedWidth]);
  
          // Create y scale (with padding)
          const valExtent = d3.extent(arr, d => d.value);
          const pad = (valExtent[1] - valExtent[0]) * 0.1;
          const yMin = valExtent[0] - pad;
          const yMax = valExtent[1] + pad;
          const y = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([waveHeight - 10, 10]);
  
          // Line generator with smooth monotone curve
          const line = d3.line()
            .x(d => x(d.time))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);
  
          // Create a group to hold two copies of the waveform for seamless scrolling
          const g = svg.append("g")
            .attr("class", "line-group");
  
          // Draw the main waveform path
          const path = g.append("path")
            .datum(arr)
            .attr("class", "wave-line")
            .attr("stroke", v.color)
            .attr("d", line);
  
          // Duplicate the path for wrap-around effect
          const duplicate = path.node().cloneNode(true);
          g.node().appendChild(duplicate);
          duplicate.setAttribute("transform", `translate(${extendedWidth},0)`);
  
          // Set up a bisector to interpolate the current value based on time
          const bisect = d3.bisector(d => d.time).left;
          let lastValue; // store the value from the previous tick
  
          // D3 timer for continuous scrolling and dynamic readout updates
          d3.timer(elapsed => {
            // Calculate horizontal translation (dx) and wrap-around
            let dx = (elapsed / 1000) * speed;
            dx = dx % extendedWidth;
            g.attr("transform", `translate(${-dx},0)`);
  
            // Determine the current x coordinate at the right edge of the visible area
            const currentX = (waveWidth + dx) % extendedWidth;
            const currentTime = x.invert(currentX);
  
            // Find the data index using the bisector and interpolate the current value
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
  
            // Check for an instantaneous change compared to the previous tick
            if (lastValue !== undefined) {
              const relChange = Math.abs(currentVal - lastValue) / Math.abs(lastValue);
              if (relChange >= flashThreshold) {
                if (!readoutCont.classed("border-flash")) {
                  readoutCont.classed("border-flash", true);
                  setTimeout(() => readoutCont.classed("border-flash", false), 500);
                }
              }
            }
            lastValue = currentVal;
  
            // Update the numeric readout with the instantaneous value (rounded)
            valueEl.html("<span class='readout-number'>" + currentVal.toFixed(0) + "</span> <span class='readout-unit'>" + v.unit + "</span>");
          });
        }, 50);
      });
  
      // --- Map button labels to the correct vital key ---
      const vitalMapping = {
        "HR": "Solar8000/HR",
        "SBP": "Solar8000/ART_SBP",
        "MBP": "Solar8000/ART_MBP",
        "DBP": "Solar8000/ART_DBP",
        "ETCO2": "Solar8000/ETCO2",
        "SpO2": "Solar8000/PLETH_SPO2"
      };
  
      // For each vital button, use its text (trimmed) to look up the correct key.
      d3.selectAll(".tv-button.vital-button").each(function() {
        const button = d3.select(this);
        const label = button.text().trim();
        const key = vitalMapping[label] || "Solar8000/HR";
        button.attr("data-key", key);
      });
  
      // Attach click event handler to navigate to the corresponding graph page.
      d3.selectAll(".tv-button.vital-button").on("click", function() {
        const key = d3.select(this).attr("data-key");
        window.location.href = "graph.html?parameter=" + encodeURIComponent(key);
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
  