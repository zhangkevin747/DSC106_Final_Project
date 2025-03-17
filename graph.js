// graph.js - Graphs Page JavaScript
const parameterTitles = {
  "HR": "Heart Rate",
  "ART_DBP": "Diastolic Blood Pressure",
  "ART_MBP": "Mean Arterial Pressure",
  "ART_SBP": "Systolic Blood Pressure",
  "ETCO2": "End-Tidal CO2",
  "PLETH_SPO2": "Oxygen Saturation"
};


// --- On DOMContentLoaded, remove the "Choose a Vital Sign" controls section ---
document.addEventListener("DOMContentLoaded", function() {
    const controls = document.getElementById("controls");
    if (controls) {
      controls.remove();
    }
    
    // Check if a parameter is provided in the URL; if not, show a message.
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get("parameter");
    if (!param) {
      d3.select("#chart").html('<div class="loading">No parameter provided. Please select a parameter from the monitor page.</div>');
      return;
    }
    drawChart(param);
});

// --- Create a Back Button on the Top Left ---
const backButton = document.createElement("button");
backButton.textContent = "Back";
backButton.style.position = "fixed";
backButton.style.top = "10px";
backButton.style.left = "10px";
backButton.style.zIndex = "1000";
backButton.style.padding = "8px 16px";
backButton.style.fontSize = "14px";
backButton.style.cursor = "pointer";
backButton.style.background = "#333";
backButton.style.color = "#fff";
backButton.style.border = "none";
backButton.style.borderRadius = "4px";

// Apply your custom font
backButton.style.fontFamily = "'CustomHeaderFont', sans-serif";

backButton.addEventListener("click", function() {
  window.location.href = "monitor.html";
});
document.body.appendChild(backButton);


function drawChart(selectedParameter) {
    d3.select("#insights-panel").style("display", "none").style("opacity", 0);
    d3.select("#tooltip").style("display", "none").style("opacity", 0);

    if (!selectedParameter) {
      d3.select("#chart").html('<div class="loading">No parameter provided. Please select a parameter from the monitor page.</div>');
      return;
    }

    // Define insights text for each parameter, including measurement info and usage.
const insightsByParameter = {
    "Solar8000/HR": `
      <ul>
        <li><strong>What it is:</strong> Heart Rate (HR) measures the number of heartbeats per minute, reflecting cardiac function and stress levels.</li>
        <li><strong>Clinical use:</strong> Monitoring HR helps detect arrhythmias, gauge cardiovascular workload, and track overall hemodynamic status.</li>
        <li><strong>Normal range:</strong> 75–95 bpm.</li>
        <li><strong>Non-Survivors:</strong> Display big spikes and are rarely in the normal range, indicating instability.</li>
        <li><strong>Survivors:</strong> Stay inside the normal range for the entire procedure, suggesting better cardiac stability.</li>
        <li>Overall, heart rate may be an indicator of survival, given the clear differences observed.</li>
      </ul>
    `,
    "Solar8000/ART_DBP": `
      <ul>
        <li><strong>What it is:</strong> Arterial Diastolic Blood Pressure (ART_DBP) measures the lowest arterial pressure when the heart is at rest between beats.</li>
        <li><strong>Clinical use:</strong> Helps evaluate vascular resistance and overall cardiovascular health.</li>
        <li><strong>Normal diastolic range:</strong> 60–80 mmHg.</li>
        <li><strong>Non-Survivors:</strong> Show more instability with large fluctuations.</li>
        <li><strong>Survivors:</strong> Maintain a higher DBP over time.</li>
        <li>Both groups can fall outside the normal range, though the difference is small.</li>
      </ul>
    `,
    "Solar8000/ART_MBP": `
      <ul>
        <li><strong>What it is:</strong> Mean Arterial Pressure (ART_MBP) is the average arterial pressure throughout one cardiac cycle.</li>
        <li><strong>Clinical use:</strong> Ensures organs are adequately perfused; critical for assessing circulatory status.</li>
        <li><strong>Normal range:</strong> 70–100 mmHg.</li>
        <li><strong>Non-Survivors:</strong> Remain in the normal range initially, but exhibit a sharp decline then rise.</li>
        <li><strong>Survivors:</strong> Stay in the normal range at first
  

    d3.select("#takeaways-content").html(insightsByParameter[selectedParameter] || "");
    d3.select("#chart").html('<div class="loading">Loading data...</div>');

    d3.json("vital_signs_data.json").then(function(rawData) {
      d3.select("#chart").html("");

      const deathData = rawData["Death"].flat().map(d => ({
        time: new Date(d.Time),
        value: +d[selectedParameter]
      })).filter(d => !isNaN(d.value));
      const survivedData = rawData["Survived"].flat().map(d => ({
        time: new Date(d.Time),
        value: +d[selectedParameter]
      })).filter(d => !isNaN(d.value));

      const cutoffDate = new Date('1969-12-31T22:00:00');
      const filteredDeathData = deathData.filter(d => d.time < cutoffDate && d.time.getFullYear() === 1969);
      const filteredSurvivedData = survivedData.filter(d => d.time < cutoffDate && d.time.getFullYear() === 1969);

      const every30thDeathData = filteredDeathData.filter((d, i) => i % 30 === 0);
      const every30thSurvivedData = filteredSurvivedData.filter((d, i) => i % 30 === 0);

      const allData = every30thDeathData.concat(every30thSurvivedData);
      if (allData.length === 0) {
        d3.select("#chart").html('<div class="loading">No data available for this parameter.</div>');
        return;
      }

      const parameterName = selectedParameter.split('/').pop();
      const chartContainer = document.getElementById('chart');
      const containerWidth = chartContainer.clientWidth;
      const width = containerWidth;
      const height = Math.min(window.innerHeight * 0.8, 700);

      // Adjust margins now that we are not using extra space on the right for the legend.
      const margin = { top: 30, right: 20, bottom: 50, left: 60 };

      const dataMin = d3.min(allData, d => d.value);
      const dataMax = d3.max(allData, d => d.value);
      const normalRanges = {
        "Solar8000/HR": [75, 95],
        "Solar8000/ART_DBP": [60, 80],
        "Solar8000/ART_MBP": [70, 100],
        "Solar8000/ART_SBP": [90, 120],
        "Solar8000/ETCO2": [35, 45],
        "Solar8000/PLETH_SPO2": [95, 100]
      };

      let yMin = dataMin * 0.95;
      let yMax = dataMax * 1.05;
      if (selectedParameter in normalRanges) {
        const [normalMin, normalMax] = normalRanges[selectedParameter];
        yMin = Math.min(yMin, normalMin * 0.95);
        yMax = Math.max(yMax, normalMax * 1.05);
      }

      const x = d3.scaleTime()
        .domain(d3.extent(allData, d => d.time))
        .range([margin.left, width - margin.right]);

      const y = d3.scaleLinear()
        .domain([yMin, yMax])
        .nice()
        .range([height - margin.bottom, margin.top]);

      const svg = d3.select("#chart").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      // Draw the grid
      svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x)
          .tickSize(-(height - margin.top - margin.bottom))
          .tickFormat("")
        )
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line")
          .attr("stroke", "#e0e0e0")
          .attr("stroke-opacity", 0.7)
        );

      svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat("")
        )
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line")
          .attr("stroke", "#e0e0e0")
          .attr("stroke-opacity", 0.7)
        );

      // Extract readable name or default to the original name
      const parameterShortName = selectedParameter.split('/').pop();
      const displayTitle = parameterTitles[parameterShortName] || parameterShortName;

      // Remove any existing chart title before adding a new one
      svg.selectAll(".chart-title").remove();

      // Chart Title
      svg.append("text")
          .attr("class", "chart-title")
          .attr("x", width / 2)
          .attr("y", margin.top / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#fff") // Ensure visibility
          .attr("font-size", "18px")
          .attr("font-weight", "bold")
          .text(`${displayTitle} Over Time`);


      // X Axis (white ticks)
      svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(8))
        .call(g => g.select(".domain").attr("stroke", "#fff"))
        .call(g => g.selectAll(".tick line").attr("stroke", "#fff"))
        .call(g => g.selectAll(".tick text").attr("fill", "#fff"));

      // Y Axis (white ticks)
      svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y))
        .call(g => g.select(".domain").attr("stroke", "#fff"))
        .call(g => g.selectAll(".tick line").attr("stroke", "#fff"))
        .call(g => g.selectAll(".tick text").attr("fill", "#fff"));

      // X Axis label
      svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height - 10)
        .text("Time");

      // Y Axis label (closer to the axis)
      svg.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height / 2))
        .attr("y", 15)
        .text(parameterName);

      // Lines
      const lineDeath = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      const lineSurvived = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      function animateLine(path, duration, delay = 0) {
        const totalLength = path.node().getTotalLength();
        path
          .attr("stroke-dasharray", totalLength + " " + totalLength)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .delay(delay)
          .duration(duration)
          .ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0);
      }

      // Death line
      const deathLinePath = svg.append("path")
        .datum(every30thDeathData)
        .style("stroke", "#e74c3c")
        .style("stroke-width", 2)
        .style("fill", "none")
        .style("opacity", 1)
        .attr("d", lineDeath);

      // Survived line
      const survivedLinePath = svg.append("path")
        .datum(every30thSurvivedData)
        .style("stroke", "#2ecc71")
        .style("stroke-width", 2)
        .style("fill", "none")
        .style("opacity", 1)
        .attr("d", lineSurvived);

      // Animation Durations
      const totalTimeRange = x.domain()[1] - x.domain()[0];
      const baseAnimationDuration = 6000;
      const speedFactor = baseAnimationDuration / totalTimeRange;

      const deathStartTime = d3.min(every30thDeathData, d => d.time);
      const deathEndTime = d3.max(every30thDeathData, d => d.time);
      const deathDuration = (deathEndTime - deathStartTime) * speedFactor;

      const survivedStartTime = d3.min(every30thSurvivedData, d => d.time);
      const survivedEndTime = d3.max(every30thSurvivedData, d => d.time);
      const survivedDuration = (survivedEndTime - survivedStartTime) * speedFactor;

      // Animate lines
      animateLine(deathLinePath, deathDuration);
      animateLine(survivedLinePath, survivedDuration, 200);

      // Passing Region
      const deathTimeVal = d3.max(every30thDeathData, d => d.time);
      let passingRegion, passingLabel;
      if (deathTimeVal) {
        passingRegion = svg.append("rect")
          .attr("x", x(deathTimeVal))
          .attr("y", margin.top)
          .attr("width", width - margin.right - x(deathTimeVal))
          .attr("height", height - margin.top - margin.bottom)
          .style("fill", "#e74c3c")
          .style("opacity", 0);
        passingLabel = svg.append("text")
          .attr("x", x(deathTimeVal) + 10)
          .attr("y", margin.top + 20)
          .attr("fill", "#e74c3c")
          .attr("font-size", "15px")
          .attr("font-weight", "bold")
          .style("opacity", 0)
          .text("Time After Passing");
      }

      setTimeout(() => {
        if (passingRegion) passingRegion.transition().duration(1000).style("opacity", 0.2);
        if (passingLabel) passingLabel.transition().duration(1000).style("opacity", 1);
      }, survivedDuration);

      // Normal Range shading
      if (selectedParameter in normalRanges) {
        const [normalMin, normalMax] = normalRanges[selectedParameter];
        svg.append("rect")
          .attr("x", margin.left)
          .attr("y", y(normalMax))
          .attr("width", width - margin.left - margin.right)
          .attr("height", y(normalMin) - y(normalMax))
          .style("fill", "#1E90FF")
          .style("opacity", 0.2); // More visible
        svg.append("text")
          .attr("x", width - margin.right - 120)
          .attr("y", y(normalMax) - 5)
          .attr("fill", "#1E90FF")
          .attr("font-size", "15px")
          .attr("font-weight", "bold")
          .text("Normal Range");
      }

      // Hover rect
      const hoverRect = svg.append("rect")
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .attr("transform", `translate(${margin.left}, ${margin.top})`)
        .style("fill", "none")
        .style("pointer-events", "none");

      hoverRect
        .on("mousemove", function() {
          const [mouseX] = d3.mouse(this);
          const mouseTime = x.invert(mouseX + margin.left);
          const closestDeath = every30thDeathData.reduce((prev, curr) => {
            return (Math.abs(curr.time - mouseTime) < Math.abs(prev.time - mouseTime) ? curr : prev);
          }, every30thDeathData[0]);
          const closestSurvived = every30thSurvivedData.reduce((prev, curr) => {
            return (Math.abs(curr.time - mouseTime) < Math.abs(prev.time - mouseTime) ? curr : prev);
          }, every30thSurvivedData[0]);
          const formatTime = d3.timeFormat("%I:%M %p");
          let tooltipContent = "";
          if (closestDeath && closestSurvived) {
            tooltipContent = `
              <div class="tooltip-title">${parameterName} at ${formatTime(closestDeath.time)}</div>
              <div class="tooltip-group">
                <div class="tooltip-group-title death-color">Non-Survivors</div>
                <div>Value: <strong>${closestDeath.value.toFixed(1)}</strong></div>
              </div>
              <div class="tooltip-group">
                <div class="tooltip-group-title survived-color">Survivors</div>
                <div>Value: <strong>${closestSurvived.value.toFixed(1)}</strong></div>
              </div>
            `;
          }
          d3.select("#tooltip")
            .style("display", "block")
            .style("opacity", 1)
            .html(tooltipContent)
            .style("left", (d3.event.pageX + 15) + "px")
            .style("top", (d3.event.pageY - 28) + "px");

          svg.selectAll(".hover-line").remove();
          svg.append("line")
            .attr("class", "hover-line")
            .attr("x1", mouseX + margin.left)
            .attr("x2", mouseX + margin.left)
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom);

          svg.selectAll(".highlight-point").remove();
          if (closestDeath) {
            svg.append("circle")
              .attr("class", "highlight-point")
              .attr("cx", x(closestDeath.time))
              .attr("cy", y(closestDeath.value))
              .attr("r", 6)
              .style("fill", "none")
              .style("stroke", "#e74c3c")
              .style("stroke-width", 2);
          }
          if (closestSurvived) {
            svg.append("circle")
              .attr("class", "highlight-point")
              .attr("cx", x(closestSurvived.time))
              .attr("cy", y(closestSurvived.value))
              .attr("r", 6)
              .style("fill", "none")
              .style("stroke", "#2ecc71")
              .style("stroke-width", 2);
          }
        })
        .on("mouseout", function() {
          d3.select("#tooltip").style("display", "none").style("opacity", 0);
          svg.selectAll(".hover-line").remove();
          svg.selectAll(".highlight-point").remove();
        });

      // Legend has been removed from the SVG.
      // Instead, append a legend as an HTML element below the chart.
      d3.select("#chart").append("div")
          .attr("id", "chart-legend")
          .style("text-align", "center")
          .style("margin-top", "0px")
          .style("font-family", "'CustomHeaderFont', sans-serif")
          .style("font-size", "18px")
          .html(`
            <span style="display:inline-block; margin-right: 20px;">
              <span style="background:#e74c3c; width:15px; height:15px; display:inline-block; opacity:0.8; margin-right:5px;"></span>
              Non-Survivors
            </span>
            <span style="display:inline-block;">
              <span style="background:#2ecc71; width:15px; height:15px; display:inline-block; opacity:0.8; margin-right:5px;"></span>
              Survivors
            </span>
          `);


      const totalAnimationTime = Math.max(deathDuration, survivedDuration) + 2000;
      setTimeout(() => {
        d3.select("#insights-panel").style("display", "block").style("opacity", 0);
        setTimeout(() => {
          d3.select("#insights-panel").style("opacity", 1);
        }, 50);
        hoverRect.style("pointer-events", "all");
      }, totalAnimationTime);

    }).catch(function (error) {
      console.error("Error loading data:", error);
      d3.select("#chart").html('<div class="loading">Error loading data. Please try again.</div>');
    });
}

// Redraw the chart on window resize using the provided parameter.
window.addEventListener('resize', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const param = urlParams.get("parameter");
  if (document.getElementById("graphs-page") && document.getElementById("graphs-page").style.display !== "none" && param) {
    drawChart(param);
  }
});
