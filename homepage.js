// homepage.js - Combined code for bar chart and dynamic heartbeat simulation

// ----------------- Bar Chart Code -----------------
d3.text("clinical_data.json").then(function(text) {
    const data = text.split("\n")
                     .filter(line => line.trim() !== "")
                     .map(JSON.parse);
    
    const deathsByOp = d3.nest()
      .key(d => d.opname)
      .rollup(v => d3.sum(v, d => +d.death_inhosp))
      .entries(data);
    
    // Sort descending and take the top 5
    deathsByOp.sort((a, b) => b.value - a.value);
    const top5 = deathsByOp.slice(0, 5);
    
    // Find the maximum death count among the top 5
    const maxVal = d3.max(top5, d => d.value);
    
    const margin = { top: 30, right: 20, bottom: 100, left: 50 },
          width = 800 - margin.left - margin.right,
          height = 300 - margin.top - margin.bottom;
    
    const svgBar = d3.select("#bar-chart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleBand()
      .domain(top5.map(d => d.key))
      .range([0, width])
      .padding(0.1);
    
    const y = d3.scaleLinear()
      .domain([0, maxVal])
      .range([height, 0]);
    
    // X Axis
    svgBar.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
        .attr("transform", "rotate(-40)")
        .attr("dy", "-0.1em")
        .attr("dx", "-0.8em")
        .style("text-anchor", "end");
    
    // Y Axis
    svgBar.append("g")
    .call(d3.axisLeft(y));

    // Y-axis title: "Number of Deaths" with a smaller font size
    svgBar.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -height / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("fill", "#fff")
    .style("font-size", "12px")  // Reduced font size here
    .text("Number of Deaths");

    
    // Bars: Light grey by default, red if it’s the max bar
    svgBar.selectAll(".bar")
      .data(top5)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value))
        .attr("fill", d => d.value === maxVal ? "#e74c3c" : "#bdc3c7")
        .on("mouseover", function(d) {
          const newColor = d.value === maxVal ? "#c0392b" : "#95a5a6";
          d3.select(this).transition().duration(200).attr("fill", newColor);
        })
        .on("mouseout", function(d) {
          const originalColor = d.value === maxVal ? "#e74c3c" : "#bdc3c7";
          d3.select(this).transition().duration(200).attr("fill", originalColor);
        });
    
    // Chart Title
    svgBar.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#fff")
      .text("Top 5 Operations with Most Deaths");
  }).catch(error => {
    console.error("Error loading clinical data:", error);
  });
  
  // When the homepage button is clicked, hide the wave background and navigate to minigame.html
  document.getElementById("home-next-btn").addEventListener("click", function() {
    document.getElementById("wave-background").style.display = "none";
    window.location.href = "minigame.html";
  });
  
  // ----------------- Dynamic Heartbeat Simulation -----------------
  // This section dynamically generates an ECG-like beat and updates the BPM display and heart icon
  
  const heartRateElement = document.getElementById('heart-rate');
  const heartIconElement = document.getElementById('heart-icon');
  const svgWave = d3.select("#wave-svg");
  
  // Remove any previous dynamic beat path if present.
  svgWave.select("#dynamic-beat").remove();
  
  // Baseline y-coordinate (in SVG viewBox units)
  const baseline = 300;
  
  // Use BPM range 60 to 80, slower beat, and more pronounced peaks.
  function beat() {
    // Generate a random BPM value between 60 and 80
    const bpm = Math.floor(Math.random() * 21) + 60;
    heartRateElement.textContent = bpm + " BPM";
    
    // Pulse the heart icon by adding a CSS class, then remove it after 300ms
    heartIconElement.classList.add("heart-beat");
    setTimeout(() => {
      heartIconElement.classList.remove("heart-beat");
    }, 300);
    
    // Compute beat duration (in ms) and slow it down by a factor (e.g., 1.5)
    const beatDuration = (60000 / bpm) * 1.5;
    
    // Map BPM to a spike amplitude (exaggerate differences: 60 BPM -> 20, 80 BPM -> 100)
    const amplitude = d3.scaleLinear().domain([60, 80]).range([20, 100])(bpm);
    
    // Create data points for one beat (a simple QRS-like waveform)
    const beatData = [
      { x: 0, y: baseline },
      { x: beatDuration * 0.2, y: baseline - amplitude },      // Spike peak
      { x: beatDuration * 0.25, y: baseline + amplitude * 0.3 },   // Brief dip below baseline
      { x: beatDuration, y: baseline }                           // Return to baseline
    ];
    
    // Define total width (in viewBox units) for the beat (using full SVG width of 1200)
    const totalBeatWidth = 1200;
    
    // Create a D3 line generator for the beat path
    const lineGenerator = d3.line()
      .x(d => d.x / beatDuration * totalBeatWidth)
      .y(d => d.y)
      .curve(d3.curveMonotoneX);
    
    // Remove any previous beat path
    svgWave.select("#dynamic-beat").remove();
    
    // Append a new path element for the current beat
    const path = svgWave.append("path")
      .attr("id", "dynamic-beat")
      .attr("d", lineGenerator(beatData))
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 3)
      .attr("fill", "none");
    
    // Animate the drawing of the beat using stroke-dashoffset
    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .duration(beatDuration)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end", beat);
  }
  
  // Start the dynamic heartbeat simulation
  beat();
  