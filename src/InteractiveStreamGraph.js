import React, { Component } from "react";
import * as d3 from "d3";

class InteractiveStreamGraph extends Component {
    componentDidMount() {
        this.renderChart();
    }

    componentDidUpdate() {
        this.renderChart();
    }

    componentWillUnmount() {
        // Clean up tooltip when component unmounts
        d3.select("body").selectAll(".tooltip").remove();
    }

    renderChart() {
    const chartData = this.props.csvData;
    console.log("Rendering chart with data:", chartData);
    // Don't render if data is empty
    if (!chartData || chartData.length === 0) {
        return;
    }
    
    // Define the LLM model names to visualize
    const llmModels = ["GPT-4", "Gemini", "PaLM-2", "Claude", "LLaMA-3.1"];

    // Define colors for each model
    const colors = { 
        "GPT-4": "#e41a1c", 
        "Gemini": "#377eb8", 
        "PaLM-2": "#4daf4a", 
        "Claude": "#984ea3", 
        "LLaMA-3.1": "#ff7f00" 
    };

    // Clear previous render
    d3.select(".svg_parent").selectAll("*").remove();

    // Set up dimensions and margins
    const margin = { top: 20, right: 200, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Create SVG group
    const svg = d3.select(".svg_parent")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data for stack
    const data = chartData.map(d => ({
        date: d.Date,
        ...llmModels.reduce((acc, model) => {
            acc[model] = d[model] || 0;
            return acc;
        }, {})
    }));

    // Create stack
    const stack = d3.stack()
        .keys(llmModels)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetWiggle);

    const stackedData = stack(data);

    // Set up scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([
            d3.min(stackedData, d => d3.min(d, d => d[0])),
            d3.max(stackedData, d => d3.max(d, d => d[1]))
        ])
        .range([height, 0]);

    // Create area generator
    const area = d3.area()
        .x(d => xScale(d.data.date))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveBasis);

    // Create or get tooltip container
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "lightgray")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("z-index", "1000");
    }

    // Draw streamgraph areas
    const layers = g.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", "layer")
        .attr("fill", d => colors[d.key]);

    layers.append("path")
        .attr("class", "area")
        .attr("d", area)
        .style("opacity", 0.8)
        .on("mouseover", function(event, d) {
            // Show tooltip
            tooltip.style("opacity", 1);
            
            // Get model name
            const modelName = d.key;
            const modelColor = colors[modelName];
            
            // Get data for this model
            const modelData = data.map((item, i) => ({
                date: item.date,
                value: item[modelName]
            }));

            // Create mini bar chart
            const tooltipWidth = 200;
            const tooltipHeight = 150;
            const tooltipMargin = { top: 20, right: 20, bottom: 30, left: 40 };
            const tooltipChartWidth = tooltipWidth - tooltipMargin.left - tooltipMargin.right;
            const tooltipChartHeight = tooltipHeight - tooltipMargin.top - tooltipMargin.bottom;

            // Clear previous content
            tooltip.html("");

            // Create tooltip SVG
            const tooltipSvg = tooltip.append("svg")
                .attr("width", tooltipWidth)
                .attr("height", tooltipHeight);

            const tooltipG = tooltipSvg.append("g")
                .attr("transform", `translate(${tooltipMargin.left},${tooltipMargin.top})`);

            // Scales for mini chart
            const tooltipXScale = d3.scaleBand()
                .domain(modelData.map(d => d.date))
                .range([0, tooltipChartWidth])
                .padding(0.1);

            const tooltipYScale = d3.scaleLinear()
                .domain([0, d3.max(modelData, d => d.value)])
                .range([tooltipChartHeight, 0]);

            // X axis
            const tooltipXAxis = d3.axisBottom(tooltipXScale)
                .tickFormat(d3.timeFormat("%b"));
            
            tooltipG.append("g")
                .attr("transform", `translate(0,${tooltipChartHeight})`)
                .call(tooltipXAxis)
                .selectAll("text")
                .style("font-size", "10px");

            // Y axis
            const tooltipYAxis = d3.axisLeft(tooltipYScale);
            
            tooltipG.append("g")
                .call(tooltipYAxis)
                .selectAll("text")
                .style("font-size", "10px");

            // Bars
            tooltipG.selectAll(".bar")
                .data(modelData)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", d => tooltipXScale(d.date))
                .attr("y", d => tooltipYScale(d.value))
                .attr("width", tooltipXScale.bandwidth())
                .attr("height", d => tooltipChartHeight - tooltipYScale(d.value))
                .attr("fill", modelColor);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });

    // Add x-axis
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%b"));
    
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    // Add y-axis
    const yAxis = d3.axisLeft(yScale);
    
    g.append("g")
        .call(yAxis);

    // Create legend
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width + margin.left + 20}, ${margin.top})`);

    const legendItems = legend.selectAll(".legend-item")
        .data(llmModels)
        .enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 25})`);

    legendItems.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", d => colors[d]);

    legendItems.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .style("font-size", "12px")
        .text(d => d);

  }

  render() {
    return (
      <svg style={{ width: 600, height: 500 }} className="svg_parent">
        
      </svg>
    );
  }
}

export default InteractiveStreamGraph;
