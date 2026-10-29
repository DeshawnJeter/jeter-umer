# Tilemap placement and reachability

Use for levels and their checker. The map is a 15 by 10 grid. Validate integer coordinates, distinct spawn/exit/star cells, and no required object in a wall. Flood-fill traversable adjacent cells from spawn and verify every star and the exit is reachable. Report inspected cell count and failures. Grid reachability does not prove movement physics or difficulty feel in the browser.
