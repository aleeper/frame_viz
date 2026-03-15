# Future: Topology View

Design notes from 2026-03-14 design discussion.

## Vision

A second panel alongside the 3D view showing the *kinematic graph* as an abstract 2D graph:
- **Nodes**: frames / bodies
- **Edges**: declared kinematic relationships

Disjoint subgraphs are immediately visually obvious — two islands with no connecting edge means there is a missing kinematic relationship between those bodies.

## Why this matters (MotionGenesis / SimPy use case)

In symbolic multibody dynamics tools (MotionGenesis, Autolev, SimPy), you declare relationships like:

```
Bo.translate(No, x*nx> + y*ny>)
```

This declares:
- `p_Bo_No = x·nx + y·ny` (position)
- `v_Bo_in_N = ẋ·nx + ẏ·ny` (velocity, by differentiation)
- `a_Bo_in_N = ẍ·nx + ÿ·ny` (acceleration)

If the user forgets to declare a relationship between two bodies, they are in separate disconnected subgraphs. The topology view makes this obvious.

## Relationship to current design

The current frame tree is a **zero-DOF (rigid) special case** of the kinematic graph:
- Rigid transform = joint with 0 degrees of freedom
- Symbolic/parametric transform = joint with generalized coordinates

The graph topology and disconnection semantics are identical across both.

## Observer frame and the topology view

The observer frame (`observerFrameId`) is a *view concept*, not a graph property. The topology view would display the graph without reference to any observer. Each view has its own observer frame.

## Disconnection in the current system

When `observerFrameId` is set, frames not connected to the observer frame's tree are:
- Not rendered in the 3D view
- Shown with a warning icon in FrameList

This warning icon is the current UI manifestation of graph disconnection. The topology view would make this structural, not incidental.

## Future edge types to consider

- Rigid offset (current): `parent_T_child = constant`
- Prismatic joint: `parent_T_child = I + t·axis`, t ∈ ℝ
- Revolute joint: `parent_T_child = Rot(axis, θ)`, θ ∈ ℝ
- General symbolic: `parent_T_child = f(q₁, q₂, ...)`
- Constraint: not a parent-child edge, but a loop-closing equality

## Implementation notes (future)

- Same `composePath` semantics, but edges carry a transform *function* instead of a fixed `Pose`
- Generalized coordinates `q` would be a separate state (not baked into pose data)
- Symbolic differentiation needed for velocity/acceleration
- The topology 2D layout can use a force-directed graph layout (e.g. d3-force)
