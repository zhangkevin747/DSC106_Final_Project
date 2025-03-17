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
    
    // Y-axis title
    svgBar.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", "#fff")
      .style("font-size", "12px")
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
  
  document.getElementById("home-next-btn").addEventListener("click", function() {
    document.getElementById("wave-background").style.display = "none";
    window.location.href = "minigame.html";
  });
  
// ----------------- Dynamic Heartbeat Simulation -----------------
const heartRateValueElement = document.getElementById('heart-rate-value');
const heartRateUnitElement = document.getElementById('heart-rate-unit');
const heartIconElement = document.getElementById('heart-icon');
const svgWave = d3.select("#wave-svg");
svgWave.select("#dynamic-beat").remove();
const baseline = 300;
function beat() {
  const bpm = Math.floor(Math.random() * 21) + 60;
  // Update each element separately so the spans aren't overwritten
  heartRateValueElement.textContent = bpm;
  heartRateUnitElement.textContent = " BPM";
  heartIconElement.classList.add("heart-beat");
  setTimeout(() => {
    heartIconElement.classList.remove("heart-beat");
  }, 300);
  const beatDuration = (60000 / bpm) * 1.5;
  const amplitude = d3.scaleLinear().domain([60, 80]).range([20, 100])(bpm);
  const beatData = [
    { x: 0, y: baseline },
    { x: beatDuration * 0.2, y: baseline - amplitude },
    { x: beatDuration * 0.25, y: baseline + amplitude * 0.3 },
    { x: beatDuration, y: baseline }
  ];
  const totalBeatWidth = 1200;
  const lineGenerator = d3.line()
    .x(d => d.x / beatDuration * totalBeatWidth)
    .y(d => d.y)
    .curve(d3.curveMonotoneX);
  svgWave.select("#dynamic-beat").remove();
  const path = svgWave.append("path")
    .attr("id", "dynamic-beat")
    .attr("d", lineGenerator(beatData))
    .attr("stroke", "#e74c3c")
    .attr("stroke-width", 3)
    .attr("fill", "none");
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
beat();
