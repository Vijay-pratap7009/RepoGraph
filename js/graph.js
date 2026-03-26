/* ============================================================
   graph.js — D3.js Force-Directed Graph Rendering
   Nodes = repos, Edges = shared topics, interactive & animated
   ============================================================ */

const RepoGraph = (() => {
    // Language → Color palette (curated for visual harmony)
    const LANGUAGE_COLORS = {
        'JavaScript':   '#f7df1e',
        'TypeScript':   '#3178c6',
        'Python':       '#3572A5',
        'Java':         '#b07219',
        'C':            '#555555',
        'C++':          '#f34b7d',
        'C#':           '#178600',
        'Go':           '#00ADD8',
        'Rust':         '#dea584',
        'Ruby':         '#701516',
        'PHP':          '#4F5D95',
        'Swift':        '#F05138',
        'Kotlin':       '#A97BFF',
        'Dart':         '#00B4AB',
        'Scala':        '#c22d40',
        'R':            '#198CE7',
        'Shell':        '#89e051',
        'Lua':          '#000080',
        'Perl':         '#0298c3',
        'Haskell':      '#5e5086',
        'Elixir':       '#6e4a7e',
        'Clojure':      '#db5855',
        'Vim Script':   '#199f4b',
        'HTML':         '#e34c26',
        'CSS':          '#563d7c',
        'SCSS':         '#c6538c',
        'Vue':          '#41b883',
        'Svelte':       '#ff3e00',
        'Jupyter Notebook': '#DA5B0B',
        'Dockerfile':   '#384d54',
        'Makefile':     '#427819',
        'Unknown':      '#8b949e',
    };

    // Extra colors for languages not in the palette
    const EXTRA_COLORS = [
        '#e06c75', '#98c379', '#61afef', '#c678dd', '#d19a66',
        '#56b6c2', '#e5c07b', '#be5046', '#7ec8e3', '#ff6b6b',
        '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4',
        '#f368e0', '#ff9f43', '#ee5a24', '#0abde3', '#10ac84',
    ];

    let colorIndex = 0;
    const dynamicColorMap = {};

    function getLanguageColor(language) {
        if (LANGUAGE_COLORS[language]) return LANGUAGE_COLORS[language];
        if (dynamicColorMap[language]) return dynamicColorMap[language];
        dynamicColorMap[language] = EXTRA_COLORS[colorIndex % EXTRA_COLORS.length];
        colorIndex++;
        return dynamicColorMap[language];
    }

    let simulation = null;
    let svg = null;
    let g = null;
    let currentData = null;

    /**
     * Build graph data from enriched repos
     */
    function buildGraphData(repos) {
        const nodes = repos.map(repo => ({
            id: repo.name,
            repo: repo,
            radius: Math.max(6, Math.min(30, 4 + Math.log2(repo.stars + 1) * 3)),
            color: getLanguageColor(repo.language),
        }));

        const edges = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Build edges based on shared topics
        for (let i = 0; i < repos.length; i++) {
            for (let j = i + 1; j < repos.length; j++) {
                const shared = repos[i].topics.filter(t => repos[j].topics.includes(t));
                if (shared.length > 0) {
                    edges.push({
                        source: repos[i].name,
                        target: repos[j].name,
                        weight: shared.length,
                        sharedTopics: shared,
                    });
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Render the force-directed graph
     */
    function render(repos, containerSelector) {
        // Clear previous
        destroy();

        const graphData = buildGraphData(repos);
        currentData = graphData;

        const container = document.querySelector(containerSelector);
        const width = container.clientWidth;
        const height = container.clientHeight;

        svg = d3.select('#graph-svg')
            .attr('width', width)
            .attr('height', height);

        // Zoom group
        g = svg.append('g');

        zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Initial setup
        const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2);
        svg.call(zoom.transform, initialTransform);

        // Force simulation (Denser MIROFISH style)
        simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.edges)
                .id(d => d.id)
                .distance(d => Math.max(20, 80 - d.weight * 15)) // Tighter distances
                .strength(d => Math.min(1.2, 0.3 + d.weight * 0.2)) // Stronger links
            )
            .force('charge', d3.forceManyBody()
                .strength(d => -Math.max(40, d.radius * 5)) // Reduced repulsion for denser packing
                .distanceMax(250)
            )
            .force('center', d3.forceCenter(0, 0).strength(0.05)) // Pull towards center
            .force('collide', d3.forceCollide().radius(d => d.radius + 3).strength(0.9)) // Tighter collision
            .force('x', d3.forceX(0).strength(0.08)) // Stronger gravity X
            .force('y', d3.forceY(0).strength(0.08)) // Stronger gravity Y
            .alphaDecay(0.015) // Simulate longer to settle perfectly
            .velocityDecay(0.4); // Higher drag for stability

        // Draw visible edges (Colored MIROFISH style)
        const isDark = document.body.classList.contains('dark');
        const defaultStroke = isDark ? '#ff4785' : '#ff2a5f'; // Hot pink / red

        const links = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(graphData.edges)
            .join('line')
            .attr('class', 'link-line')
            .attr('stroke', defaultStroke)
            .attr('stroke-width', d => Math.min(3, 0.6 + d.weight * 0.6))
            .attr('stroke-opacity', d => Math.min(0.45, 0.1 + d.weight * 0.08));

        // Invisible wider edge hit areas (for easier hover)
        const linkHitAreas = g.append('g')
            .attr('class', 'link-hit-areas')
            .selectAll('line')
            .data(graphData.edges)
            .join('line')
            .attr('class', 'link-hit-area')
            .attr('stroke-width', 14)
            .attr('stroke', 'transparent')
            .attr('fill', 'none')
            .style('cursor', 'pointer');

        // Edge interaction: hover to show shared topics
        linkHitAreas
            .on('mouseenter', (event, d) => {
                showEdgeTooltip(event, d);
                // Highlight this edge
                links.classed('link-dimmed', l => l !== d);
                links.filter(l => l === d).classed('link-highlighted', true);
            })
            .on('mousemove', (event) => {
                moveEdgeTooltip(event);
            })
            .on('mouseleave', () => {
                hideEdgeTooltip();
                links.classed('link-dimmed', false).classed('link-highlighted', false);
            });

        // Edge labels showing shared topic count
        const edgeLabels = g.append('g')
            .attr('class', 'edge-labels')
            .selectAll('g')
            .data(graphData.edges)
            .join('g')
            .attr('class', 'edge-label-group');

        edgeLabels.append('circle')
            .attr('class', 'edge-label-bg')
            .attr('r', 9)
            .attr('fill', 'var(--bg-secondary)')
            .attr('stroke', 'var(--border)')
            .attr('stroke-width', 1);

        edgeLabels.append('text')
            .attr('class', 'edge-label-text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '9px')
            .attr('font-weight', '600')
            .attr('fill', 'var(--accent)')
            .text(d => d.weight);

        // Draw nodes
        const nodeGroups = g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(graphData.nodes)
            .join('g')
            .attr('class', 'node-group')
            .call(drag(simulation));

        // Node circles
        nodeGroups.append('circle')
            .attr('class', 'node-circle')
            .attr('r', 0)
            .attr('fill', d => d.color)
            .attr('stroke', d => d3.color(d.color).darker(0.4))
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.9)
            .transition()
            .duration(600)
            .delay((d, i) => i * 15)
            .attr('r', d => d.radius);

        // Node labels
        nodeGroups.append('text')
            .attr('class', 'node-label')
            .attr('dy', d => d.radius + 14)
            .text(d => d.id.length > 18 ? d.id.slice(0, 16) + '…' : d.id)
            .attr('opacity', 0)
            .transition()
            .duration(400)
            .delay((d, i) => 300 + i * 15)
            .attr('opacity', 1);

        // Interaction: hover
        nodeGroups
            .on('mouseenter', (event, d) => {
                handleNodeHover(d, nodeGroups, links, true);
                showTooltip(event, d, graphData.edges);
            })
            .on('mousemove', (event) => {
                moveTooltip(event);
            })
            .on('mouseleave', (event, d) => {
                handleNodeHover(d, nodeGroups, links, false);
                hideTooltip();
            })
            .on('click', (event, d) => {
                // Select node to open details panel
                event.stopPropagation();
                selectNode(d, nodeGroups, links);
                window.dispatchEvent(new CustomEvent('node-selected', { detail: d.repo }));
            })
            .on('dblclick', (event, d) => {
                // Double click to open GitHub URL
                window.open(d.repo.url, '_blank');
            })
            .on('contextmenu', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof Features !== 'undefined') {
                    Features.toggleComparisonSelect(d.id);
                }
            });

        // Click on background clears selection
        svg.on('click', () => {
            clearHighlight();
            window.dispatchEvent(new CustomEvent('node-selected', { detail: null }));
        });

        let tickCount = 0;
        // Simulation tick
        simulation.on('tick', () => {
            links
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            linkHitAreas
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            edgeLabels.attr('transform', d => {
                const mx = (d.source.x + d.target.x) / 2;
                const my = (d.source.y + d.target.y) / 2;
                return `translate(${mx},${my})`;
            });

            nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        return graphData;
    }

    /**
     * Handle node hover: highlight connected, dim others
     */
    function handleNodeHover(hoveredNode, nodeGroups, links, isHovering) {
        if (!isHovering) {
            nodeGroups.classed('node-dimmed', false);
            links.classed('link-dimmed', false).classed('link-highlighted', false);
            return;
        }

        const connectedIds = new Set();
        connectedIds.add(hoveredNode.id);

        links.each(function(d) {
            const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
            const targetId = typeof d.target === 'object' ? d.target.id : d.target;
            if (sourceId === hoveredNode.id) connectedIds.add(targetId);
            if (targetId === hoveredNode.id) connectedIds.add(sourceId);
        });

        nodeGroups.classed('node-dimmed', d => !connectedIds.has(d.id));

        links
            .classed('link-dimmed', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return sourceId !== hoveredNode.id && targetId !== hoveredNode.id;
            })
            .classed('link-highlighted', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return sourceId === hoveredNode.id || targetId === hoveredNode.id;
            });
    }

    /**
     * persistent node selection formatting
     */
    let selectedNodeId = null;
    function selectNode(node, nodeGroups, links) {
        selectedNodeId = node.id;
        
        // Remove glow from others
        d3.selectAll('.node-circle').classed('node-selected', false);
        
        // Add glow to selected
        nodeGroups.filter(d => d.id === node.id).select('.node-circle').classed('node-selected', true);
        
        // Keep the hover state alive for connections
        handleNodeHover(node, nodeGroups, links, true);
    }

    /**
     * Node Tooltip: shows repo info + connections to other repos
     */
    function showTooltip(event, d, edges) {
        const tooltip = document.getElementById('tooltip');
        const repo = d.repo;

        document.getElementById('tooltip-name').textContent = repo.name;

        const langBadge = document.getElementById('tooltip-language');
        langBadge.textContent = repo.language;
        langBadge.style.background = d.color + '22';
        langBadge.style.color = d.color;

        document.getElementById('tooltip-description').textContent =
            repo.description || 'No description available.';

        document.getElementById('tooltip-stars').querySelector('span').textContent = repo.stars.toLocaleString();
        document.getElementById('tooltip-forks').querySelector('span').textContent = repo.forks.toLocaleString();

        const topicsContainer = document.getElementById('tooltip-topics');
        topicsContainer.innerHTML = '';
        if (repo.topics.length > 0) {
            repo.topics.forEach(topic => {
                const tag = document.createElement('span');
                tag.className = 'tooltip-topic-tag';
                tag.textContent = topic;
                topicsContainer.appendChild(tag);
            });
        }

        // Build connections section
        const connectionsContainer = document.getElementById('tooltip-connections');
        connectionsContainer.innerHTML = '';

        if (edges && edges.length > 0) {
            const connectedEdges = edges.filter(e => {
                const sId = typeof e.source === 'object' ? e.source.id : e.source;
                const tId = typeof e.target === 'object' ? e.target.id : e.target;
                return sId === d.id || tId === d.id;
            });

            if (connectedEdges.length > 0) {
                const header = document.createElement('div');
                header.className = 'connections-header';
                header.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Connected to ${connectedEdges.length} repo${connectedEdges.length > 1 ? 's' : ''}:`;
                connectionsContainer.appendChild(header);

                connectedEdges.forEach(edge => {
                    const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
                    const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;
                    const otherName = sId === d.id ? tId : sId;

                    const connItem = document.createElement('div');
                    connItem.className = 'connection-item';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'connection-repo-name';
                    nameSpan.textContent = otherName;

                    const topicsSpan = document.createElement('span');
                    topicsSpan.className = 'connection-topics';
                    topicsSpan.textContent = edge.sharedTopics.join(', ');

                    connItem.appendChild(nameSpan);
                    connItem.appendChild(topicsSpan);
                    connectionsContainer.appendChild(connItem);
                });
            }
        }

        tooltip.classList.remove('hidden');
        moveTooltip(event);
    }

    function moveTooltip(event) {
        const tooltip = document.getElementById('tooltip');
        const graphArea = document.getElementById('graph-area');
        const rect = graphArea.getBoundingClientRect();

        let x = event.clientX - rect.left + 16;
        let y = event.clientY - rect.top + 16;

        if (x + 300 > rect.width) x = event.clientX - rect.left - 300;
        if (y + 280 > rect.height) y = event.clientY - rect.top - 280;

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    function hideTooltip() {
        document.getElementById('tooltip').classList.add('hidden');
    }

    /**
     * Edge Tooltip: shows connection details between two repos
     */
    function showEdgeTooltip(event, d) {
        const tooltip = document.getElementById('edge-tooltip');

        const sourceName = typeof d.source === 'object' ? d.source.id : d.source;
        const targetName = typeof d.target === 'object' ? d.target.id : d.target;

        document.getElementById('edge-source').textContent = sourceName;
        document.getElementById('edge-target').textContent = targetName;

        const topicsContainer = document.getElementById('edge-shared-topics');
        topicsContainer.innerHTML = '';
        d.sharedTopics.forEach(topic => {
            const tag = document.createElement('span');
            tag.className = 'tooltip-topic-tag';
            tag.textContent = topic;
            topicsContainer.appendChild(tag);
        });

        tooltip.classList.remove('hidden');
        moveEdgeTooltip(event);
    }

    function moveEdgeTooltip(event) {
        const tooltip = document.getElementById('edge-tooltip');
        const graphArea = document.getElementById('graph-area');
        const rect = graphArea.getBoundingClientRect();

        let x = event.clientX - rect.left + 16;
        let y = event.clientY - rect.top + 16;

        if (x + 260 > rect.width) x = event.clientX - rect.left - 260;
        if (y + 140 > rect.height) y = event.clientY - rect.top - 140;

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    function hideEdgeTooltip() {
        document.getElementById('edge-tooltip').classList.add('hidden');
    }

    /**
     * D3 drag behavior
     */
    function drag(simulation) {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    /**
     * Destroy current graph
     */
    function destroy() {
        if (simulation) {
            simulation.stop();
            simulation = null;
        }
        d3.select('#graph-svg').selectAll('*').remove();
        currentData = null;
    }

    /**
     * Get unique languages with their colors
     */
    function getLanguageMap(repos) {
        const map = new Map();
        repos.forEach(r => {
            if (!map.has(r.language)) {
                map.set(r.language, getLanguageColor(r.language));
            }
        });
        const sorted = [...map.entries()].sort((a, b) => {
            const countA = repos.filter(r => r.language === a[0]).length;
            const countB = repos.filter(r => r.language === b[0]).length;
            return countB - countA;
        });
        return new Map(sorted);
    }

    /**
     * Zoom to a specific node by name
     */
    function zoomToNode(nodeName) {
        if (!currentData || !svg) return;
        const node = currentData.nodes.find(n => n.id === nodeName);
        if (!node) return;

        const container = document.querySelector('#graph-area');
        const width = container.clientWidth;
        const height = container.clientHeight;

        const targetScale = 2;
        const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(targetScale)
            .translate(-node.x, -node.y);

        svg.transition()
            .duration(750)
            .call(d3.zoom().scaleExtent([0.1, 6]).on('zoom', (event) => {
                g.attr('transform', event.transform);
            }).transform, transform);

        // Pulse the node
        d3.selectAll('.node-group').each(function(d) {
            if (d.id === nodeName) {
                d3.select(this).select('.node-circle')
                    .transition().duration(300)
                    .attr('stroke-width', 4)
                    .attr('stroke', 'var(--accent)')
                    .transition().duration(300)
                    .attr('stroke-width', 1.5)
                    .attr('stroke', d3.color(d.color).darker(0.4))
                    .transition().duration(300)
                    .attr('stroke-width', 4)
                    .attr('stroke', 'var(--accent)')
                    .transition().duration(600)
                    .attr('stroke-width', 1.5)
                    .attr('stroke', d3.color(d.color).darker(0.4));
            }
        });
    }

    /**
     * Clear all highlights
     */
    function clearHighlight() {
        selectedNodeId = null;
        d3.selectAll('.node-group').classed('node-dimmed', false);
        d3.selectAll('.link-line').classed('link-dimmed', false).classed('link-highlighted', false);
        d3.selectAll('.node-circle').classed('node-selected', false);
    }

    /**
     * Trigger a relayout by adding \"heat\" to the simulation
     */
    function relayout() {
        if (simulation) {
            simulation.alpha(1).restart();
        }
    }

    /**
     * Get current graph nodes (for minimap)
     */
    function getGraphNodes() {
        return currentData ? currentData.nodes : [];
    }

    /**
     * Count edges in graph data
     */
    function getEdgeCount(repos) {
        const data = buildGraphData(repos);
        return data.edges.length;
    }

    return {
        render, destroy, getLanguageMap, getLanguageColor, getEdgeCount,
        buildGraphData, zoomToNode, clearHighlight, getGraphNodes, relayout
    };
})();
