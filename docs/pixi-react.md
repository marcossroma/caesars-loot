# React and PixiJS

React owns the application-facing host and accessible loading status. `PixiRuntime` owns one shared
PixiJS `Application` and the active scene. A short deferred lease release avoids duplicate
applications during React Strict Mode's development-only effect replay without hiding real unmounts.

`ResizeObserver` measures the Canvas host and resizes the renderer plus active scene. Teardown removes
ticker callbacks, destroys scene children, unloads the background asset, destroys the renderer and
removes the Canvas. Hot-module replacement follows the same cleanup path.

Future milestones will place `GameController` between React and the PixiJS board without coupling the
renderer to React rerenders.

The Canvas currently exposes a concise external accessibility description. Individual tiles are not
yet keyboard navigable because PixiJS display objects are not DOM controls; a future accessibility
pass should provide a synchronized semantic control layer without moving visual gameplay into DOM.
