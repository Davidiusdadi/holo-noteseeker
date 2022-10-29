var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }
    /**
     * Associates an arbitrary `context` object with the current component and the specified `key`
     * and returns that object. The context is then available to children of the component
     * (including slotted content) with `getContext`.
     *
     * Like lifecycle functions, this must be called during component initialisation.
     *
     * https://svelte.dev/docs#run-time-svelte-setcontext
     */
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
        return context;
    }
    /**
     * Retrieves the context that belongs to the closest parent component with the specified `key`.
     * Must be called during component initialisation.
     *
     * https://svelte.dev/docs#run-time-svelte-getcontext
     */
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.52.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', {  text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    function construct_svelte_component_dev(component, props) {
        const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
        try {
            const instance = new component(props);
            if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
                throw new Error(error_message);
            }
            return instance;
        }
        catch (err) {
            const { message } = err;
            if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
                throw new Error(error_message);
            }
            else {
                throw err;
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var AppStatusFilter;
    (function (AppStatusFilter) {
        AppStatusFilter["Enabled"] = "enabled";
        AppStatusFilter["Disabled"] = "disabled";
        AppStatusFilter["Running"] = "running";
        AppStatusFilter["Stopped"] = "stopped";
        AppStatusFilter["Paused"] = "paused";
    })(AppStatusFilter || (AppStatusFilter = {}));

    // Integer Utility
    var UINT32_MAX = 4294967295;
    // DataView extension to handle int64 / uint64,
    // where the actual range is 53-bits integer (a.k.a. safe integer)
    function setUint64(view, offset, value) {
        var high = value / 4294967296;
        var low = value; // high bits are truncated by DataView
        view.setUint32(offset, high);
        view.setUint32(offset + 4, low);
    }
    function setInt64(view, offset, value) {
        var high = Math.floor(value / 4294967296);
        var low = value; // high bits are truncated by DataView
        view.setUint32(offset, high);
        view.setUint32(offset + 4, low);
    }
    function getInt64(view, offset) {
        var high = view.getInt32(offset);
        var low = view.getUint32(offset + 4);
        return high * 4294967296 + low;
    }
    function getUint64(view, offset) {
        var high = view.getUint32(offset);
        var low = view.getUint32(offset + 4);
        return high * 4294967296 + low;
    }

    var _a$1, _b$1, _c;
    var TEXT_ENCODING_AVAILABLE = (typeof process === "undefined" || ((_a$1 = process === null || process === void 0 ? void 0 : process.env) === null || _a$1 === void 0 ? void 0 : _a$1["TEXT_ENCODING"]) !== "never") &&
        typeof TextEncoder !== "undefined" &&
        typeof TextDecoder !== "undefined";
    function utf8Count(str) {
        var strLength = str.length;
        var byteLength = 0;
        var pos = 0;
        while (pos < strLength) {
            var value = str.charCodeAt(pos++);
            if ((value & 0xffffff80) === 0) {
                // 1-byte
                byteLength++;
                continue;
            }
            else if ((value & 0xfffff800) === 0) {
                // 2-bytes
                byteLength += 2;
            }
            else {
                // handle surrogate pair
                if (value >= 0xd800 && value <= 0xdbff) {
                    // high surrogate
                    if (pos < strLength) {
                        var extra = str.charCodeAt(pos);
                        if ((extra & 0xfc00) === 0xdc00) {
                            ++pos;
                            value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                        }
                    }
                }
                if ((value & 0xffff0000) === 0) {
                    // 3-byte
                    byteLength += 3;
                }
                else {
                    // 4-byte
                    byteLength += 4;
                }
            }
        }
        return byteLength;
    }
    function utf8EncodeJs(str, output, outputOffset) {
        var strLength = str.length;
        var offset = outputOffset;
        var pos = 0;
        while (pos < strLength) {
            var value = str.charCodeAt(pos++);
            if ((value & 0xffffff80) === 0) {
                // 1-byte
                output[offset++] = value;
                continue;
            }
            else if ((value & 0xfffff800) === 0) {
                // 2-bytes
                output[offset++] = ((value >> 6) & 0x1f) | 0xc0;
            }
            else {
                // handle surrogate pair
                if (value >= 0xd800 && value <= 0xdbff) {
                    // high surrogate
                    if (pos < strLength) {
                        var extra = str.charCodeAt(pos);
                        if ((extra & 0xfc00) === 0xdc00) {
                            ++pos;
                            value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                        }
                    }
                }
                if ((value & 0xffff0000) === 0) {
                    // 3-byte
                    output[offset++] = ((value >> 12) & 0x0f) | 0xe0;
                    output[offset++] = ((value >> 6) & 0x3f) | 0x80;
                }
                else {
                    // 4-byte
                    output[offset++] = ((value >> 18) & 0x07) | 0xf0;
                    output[offset++] = ((value >> 12) & 0x3f) | 0x80;
                    output[offset++] = ((value >> 6) & 0x3f) | 0x80;
                }
            }
            output[offset++] = (value & 0x3f) | 0x80;
        }
    }
    var sharedTextEncoder = TEXT_ENCODING_AVAILABLE ? new TextEncoder() : undefined;
    var TEXT_ENCODER_THRESHOLD = !TEXT_ENCODING_AVAILABLE
        ? UINT32_MAX
        : typeof process !== "undefined" && ((_b$1 = process === null || process === void 0 ? void 0 : process.env) === null || _b$1 === void 0 ? void 0 : _b$1["TEXT_ENCODING"]) !== "force"
            ? 200
            : 0;
    function utf8EncodeTEencode(str, output, outputOffset) {
        output.set(sharedTextEncoder.encode(str), outputOffset);
    }
    function utf8EncodeTEencodeInto(str, output, outputOffset) {
        sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
    }
    var utf8EncodeTE = (sharedTextEncoder === null || sharedTextEncoder === void 0 ? void 0 : sharedTextEncoder.encodeInto) ? utf8EncodeTEencodeInto : utf8EncodeTEencode;
    var CHUNK_SIZE = 4096;
    function utf8DecodeJs(bytes, inputOffset, byteLength) {
        var offset = inputOffset;
        var end = offset + byteLength;
        var units = [];
        var result = "";
        while (offset < end) {
            var byte1 = bytes[offset++];
            if ((byte1 & 0x80) === 0) {
                // 1 byte
                units.push(byte1);
            }
            else if ((byte1 & 0xe0) === 0xc0) {
                // 2 bytes
                var byte2 = bytes[offset++] & 0x3f;
                units.push(((byte1 & 0x1f) << 6) | byte2);
            }
            else if ((byte1 & 0xf0) === 0xe0) {
                // 3 bytes
                var byte2 = bytes[offset++] & 0x3f;
                var byte3 = bytes[offset++] & 0x3f;
                units.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
            }
            else if ((byte1 & 0xf8) === 0xf0) {
                // 4 bytes
                var byte2 = bytes[offset++] & 0x3f;
                var byte3 = bytes[offset++] & 0x3f;
                var byte4 = bytes[offset++] & 0x3f;
                var unit = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
                if (unit > 0xffff) {
                    unit -= 0x10000;
                    units.push(((unit >>> 10) & 0x3ff) | 0xd800);
                    unit = 0xdc00 | (unit & 0x3ff);
                }
                units.push(unit);
            }
            else {
                units.push(byte1);
            }
            if (units.length >= CHUNK_SIZE) {
                result += String.fromCharCode.apply(String, units);
                units.length = 0;
            }
        }
        if (units.length > 0) {
            result += String.fromCharCode.apply(String, units);
        }
        return result;
    }
    var sharedTextDecoder = TEXT_ENCODING_AVAILABLE ? new TextDecoder() : null;
    var TEXT_DECODER_THRESHOLD = !TEXT_ENCODING_AVAILABLE
        ? UINT32_MAX
        : typeof process !== "undefined" && ((_c = process === null || process === void 0 ? void 0 : process.env) === null || _c === void 0 ? void 0 : _c["TEXT_DECODER"]) !== "force"
            ? 200
            : 0;
    function utf8DecodeTD(bytes, inputOffset, byteLength) {
        var stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
        return sharedTextDecoder.decode(stringBytes);
    }

    /**
     * ExtData is used to handle Extension Types that are not registered to ExtensionCodec.
     */
    var ExtData = /** @class */ (function () {
        function ExtData(type, data) {
            this.type = type;
            this.data = data;
        }
        return ExtData;
    }());

    var __extends$5 = (undefined && undefined.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            if (typeof b !== "function" && b !== null)
                throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var DecodeError = /** @class */ (function (_super) {
        __extends$5(DecodeError, _super);
        function DecodeError(message) {
            var _this = _super.call(this, message) || this;
            // fix the prototype chain in a cross-platform way
            var proto = Object.create(DecodeError.prototype);
            Object.setPrototypeOf(_this, proto);
            Object.defineProperty(_this, "name", {
                configurable: true,
                enumerable: false,
                value: DecodeError.name,
            });
            return _this;
        }
        return DecodeError;
    }(Error));

    // https://github.com/msgpack/msgpack/blob/master/spec.md#timestamp-extension-type
    var EXT_TIMESTAMP = -1;
    var TIMESTAMP32_MAX_SEC = 0x100000000 - 1; // 32-bit unsigned int
    var TIMESTAMP64_MAX_SEC = 0x400000000 - 1; // 34-bit unsigned int
    function encodeTimeSpecToTimestamp(_a) {
        var sec = _a.sec, nsec = _a.nsec;
        if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
            // Here sec >= 0 && nsec >= 0
            if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
                // timestamp 32 = { sec32 (unsigned) }
                var rv = new Uint8Array(4);
                var view = new DataView(rv.buffer);
                view.setUint32(0, sec);
                return rv;
            }
            else {
                // timestamp 64 = { nsec30 (unsigned), sec34 (unsigned) }
                var secHigh = sec / 0x100000000;
                var secLow = sec & 0xffffffff;
                var rv = new Uint8Array(8);
                var view = new DataView(rv.buffer);
                // nsec30 | secHigh2
                view.setUint32(0, (nsec << 2) | (secHigh & 0x3));
                // secLow32
                view.setUint32(4, secLow);
                return rv;
            }
        }
        else {
            // timestamp 96 = { nsec32 (unsigned), sec64 (signed) }
            var rv = new Uint8Array(12);
            var view = new DataView(rv.buffer);
            view.setUint32(0, nsec);
            setInt64(view, 4, sec);
            return rv;
        }
    }
    function encodeDateToTimeSpec(date) {
        var msec = date.getTime();
        var sec = Math.floor(msec / 1e3);
        var nsec = (msec - sec * 1e3) * 1e6;
        // Normalizes { sec, nsec } to ensure nsec is unsigned.
        var nsecInSec = Math.floor(nsec / 1e9);
        return {
            sec: sec + nsecInSec,
            nsec: nsec - nsecInSec * 1e9,
        };
    }
    function encodeTimestampExtension(object) {
        if (object instanceof Date) {
            var timeSpec = encodeDateToTimeSpec(object);
            return encodeTimeSpecToTimestamp(timeSpec);
        }
        else {
            return null;
        }
    }
    function decodeTimestampToTimeSpec(data) {
        var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        // data may be 32, 64, or 96 bits
        switch (data.byteLength) {
            case 4: {
                // timestamp 32 = { sec32 }
                var sec = view.getUint32(0);
                var nsec = 0;
                return { sec: sec, nsec: nsec };
            }
            case 8: {
                // timestamp 64 = { nsec30, sec34 }
                var nsec30AndSecHigh2 = view.getUint32(0);
                var secLow32 = view.getUint32(4);
                var sec = (nsec30AndSecHigh2 & 0x3) * 0x100000000 + secLow32;
                var nsec = nsec30AndSecHigh2 >>> 2;
                return { sec: sec, nsec: nsec };
            }
            case 12: {
                // timestamp 96 = { nsec32 (unsigned), sec64 (signed) }
                var sec = getInt64(view, 4);
                var nsec = view.getUint32(0);
                return { sec: sec, nsec: nsec };
            }
            default:
                throw new DecodeError("Unrecognized data size for timestamp (expected 4, 8, or 12): ".concat(data.length));
        }
    }
    function decodeTimestampExtension(data) {
        var timeSpec = decodeTimestampToTimeSpec(data);
        return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
    }
    var timestampExtension = {
        type: EXT_TIMESTAMP,
        encode: encodeTimestampExtension,
        decode: decodeTimestampExtension,
    };

    // ExtensionCodec to handle MessagePack extensions
    var ExtensionCodec = /** @class */ (function () {
        function ExtensionCodec() {
            // built-in extensions
            this.builtInEncoders = [];
            this.builtInDecoders = [];
            // custom extensions
            this.encoders = [];
            this.decoders = [];
            this.register(timestampExtension);
        }
        ExtensionCodec.prototype.register = function (_a) {
            var type = _a.type, encode = _a.encode, decode = _a.decode;
            if (type >= 0) {
                // custom extensions
                this.encoders[type] = encode;
                this.decoders[type] = decode;
            }
            else {
                // built-in extensions
                var index = 1 + type;
                this.builtInEncoders[index] = encode;
                this.builtInDecoders[index] = decode;
            }
        };
        ExtensionCodec.prototype.tryToEncode = function (object, context) {
            // built-in extensions
            for (var i = 0; i < this.builtInEncoders.length; i++) {
                var encodeExt = this.builtInEncoders[i];
                if (encodeExt != null) {
                    var data = encodeExt(object, context);
                    if (data != null) {
                        var type = -1 - i;
                        return new ExtData(type, data);
                    }
                }
            }
            // custom extensions
            for (var i = 0; i < this.encoders.length; i++) {
                var encodeExt = this.encoders[i];
                if (encodeExt != null) {
                    var data = encodeExt(object, context);
                    if (data != null) {
                        var type = i;
                        return new ExtData(type, data);
                    }
                }
            }
            if (object instanceof ExtData) {
                // to keep ExtData as is
                return object;
            }
            return null;
        };
        ExtensionCodec.prototype.decode = function (data, type, context) {
            var decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
            if (decodeExt) {
                return decodeExt(data, type, context);
            }
            else {
                // decode() does not fail, returns ExtData instead.
                return new ExtData(type, data);
            }
        };
        ExtensionCodec.defaultCodec = new ExtensionCodec();
        return ExtensionCodec;
    }());

    function ensureUint8Array(buffer) {
        if (buffer instanceof Uint8Array) {
            return buffer;
        }
        else if (ArrayBuffer.isView(buffer)) {
            return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        }
        else if (buffer instanceof ArrayBuffer) {
            return new Uint8Array(buffer);
        }
        else {
            // ArrayLike<number>
            return Uint8Array.from(buffer);
        }
    }
    function createDataView(buffer) {
        if (buffer instanceof ArrayBuffer) {
            return new DataView(buffer);
        }
        var bufferView = ensureUint8Array(buffer);
        return new DataView(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);
    }

    var DEFAULT_MAX_DEPTH = 100;
    var DEFAULT_INITIAL_BUFFER_SIZE = 2048;
    var Encoder = /** @class */ (function () {
        function Encoder(extensionCodec, context, maxDepth, initialBufferSize, sortKeys, forceFloat32, ignoreUndefined, forceIntegerToFloat) {
            if (extensionCodec === void 0) { extensionCodec = ExtensionCodec.defaultCodec; }
            if (context === void 0) { context = undefined; }
            if (maxDepth === void 0) { maxDepth = DEFAULT_MAX_DEPTH; }
            if (initialBufferSize === void 0) { initialBufferSize = DEFAULT_INITIAL_BUFFER_SIZE; }
            if (sortKeys === void 0) { sortKeys = false; }
            if (forceFloat32 === void 0) { forceFloat32 = false; }
            if (ignoreUndefined === void 0) { ignoreUndefined = false; }
            if (forceIntegerToFloat === void 0) { forceIntegerToFloat = false; }
            this.extensionCodec = extensionCodec;
            this.context = context;
            this.maxDepth = maxDepth;
            this.initialBufferSize = initialBufferSize;
            this.sortKeys = sortKeys;
            this.forceFloat32 = forceFloat32;
            this.ignoreUndefined = ignoreUndefined;
            this.forceIntegerToFloat = forceIntegerToFloat;
            this.pos = 0;
            this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
            this.bytes = new Uint8Array(this.view.buffer);
        }
        Encoder.prototype.reinitializeState = function () {
            this.pos = 0;
        };
        /**
         * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
         *
         * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
         */
        Encoder.prototype.encodeSharedRef = function (object) {
            this.reinitializeState();
            this.doEncode(object, 1);
            return this.bytes.subarray(0, this.pos);
        };
        /**
         * @returns Encodes the object and returns a copy of the encoder's internal buffer.
         */
        Encoder.prototype.encode = function (object) {
            this.reinitializeState();
            this.doEncode(object, 1);
            return this.bytes.slice(0, this.pos);
        };
        Encoder.prototype.doEncode = function (object, depth) {
            if (depth > this.maxDepth) {
                throw new Error("Too deep objects in depth ".concat(depth));
            }
            if (object == null) {
                this.encodeNil();
            }
            else if (typeof object === "boolean") {
                this.encodeBoolean(object);
            }
            else if (typeof object === "number") {
                this.encodeNumber(object);
            }
            else if (typeof object === "string") {
                this.encodeString(object);
            }
            else {
                this.encodeObject(object, depth);
            }
        };
        Encoder.prototype.ensureBufferSizeToWrite = function (sizeToWrite) {
            var requiredSize = this.pos + sizeToWrite;
            if (this.view.byteLength < requiredSize) {
                this.resizeBuffer(requiredSize * 2);
            }
        };
        Encoder.prototype.resizeBuffer = function (newSize) {
            var newBuffer = new ArrayBuffer(newSize);
            var newBytes = new Uint8Array(newBuffer);
            var newView = new DataView(newBuffer);
            newBytes.set(this.bytes);
            this.view = newView;
            this.bytes = newBytes;
        };
        Encoder.prototype.encodeNil = function () {
            this.writeU8(0xc0);
        };
        Encoder.prototype.encodeBoolean = function (object) {
            if (object === false) {
                this.writeU8(0xc2);
            }
            else {
                this.writeU8(0xc3);
            }
        };
        Encoder.prototype.encodeNumber = function (object) {
            if (Number.isSafeInteger(object) && !this.forceIntegerToFloat) {
                if (object >= 0) {
                    if (object < 0x80) {
                        // positive fixint
                        this.writeU8(object);
                    }
                    else if (object < 0x100) {
                        // uint 8
                        this.writeU8(0xcc);
                        this.writeU8(object);
                    }
                    else if (object < 0x10000) {
                        // uint 16
                        this.writeU8(0xcd);
                        this.writeU16(object);
                    }
                    else if (object < 0x100000000) {
                        // uint 32
                        this.writeU8(0xce);
                        this.writeU32(object);
                    }
                    else {
                        // uint 64
                        this.writeU8(0xcf);
                        this.writeU64(object);
                    }
                }
                else {
                    if (object >= -0x20) {
                        // negative fixint
                        this.writeU8(0xe0 | (object + 0x20));
                    }
                    else if (object >= -0x80) {
                        // int 8
                        this.writeU8(0xd0);
                        this.writeI8(object);
                    }
                    else if (object >= -0x8000) {
                        // int 16
                        this.writeU8(0xd1);
                        this.writeI16(object);
                    }
                    else if (object >= -0x80000000) {
                        // int 32
                        this.writeU8(0xd2);
                        this.writeI32(object);
                    }
                    else {
                        // int 64
                        this.writeU8(0xd3);
                        this.writeI64(object);
                    }
                }
            }
            else {
                // non-integer numbers
                if (this.forceFloat32) {
                    // float 32
                    this.writeU8(0xca);
                    this.writeF32(object);
                }
                else {
                    // float 64
                    this.writeU8(0xcb);
                    this.writeF64(object);
                }
            }
        };
        Encoder.prototype.writeStringHeader = function (byteLength) {
            if (byteLength < 32) {
                // fixstr
                this.writeU8(0xa0 + byteLength);
            }
            else if (byteLength < 0x100) {
                // str 8
                this.writeU8(0xd9);
                this.writeU8(byteLength);
            }
            else if (byteLength < 0x10000) {
                // str 16
                this.writeU8(0xda);
                this.writeU16(byteLength);
            }
            else if (byteLength < 0x100000000) {
                // str 32
                this.writeU8(0xdb);
                this.writeU32(byteLength);
            }
            else {
                throw new Error("Too long string: ".concat(byteLength, " bytes in UTF-8"));
            }
        };
        Encoder.prototype.encodeString = function (object) {
            var maxHeaderSize = 1 + 4;
            var strLength = object.length;
            if (strLength > TEXT_ENCODER_THRESHOLD) {
                var byteLength = utf8Count(object);
                this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
                this.writeStringHeader(byteLength);
                utf8EncodeTE(object, this.bytes, this.pos);
                this.pos += byteLength;
            }
            else {
                var byteLength = utf8Count(object);
                this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
                this.writeStringHeader(byteLength);
                utf8EncodeJs(object, this.bytes, this.pos);
                this.pos += byteLength;
            }
        };
        Encoder.prototype.encodeObject = function (object, depth) {
            // try to encode objects with custom codec first of non-primitives
            var ext = this.extensionCodec.tryToEncode(object, this.context);
            if (ext != null) {
                this.encodeExtension(ext);
            }
            else if (Array.isArray(object)) {
                this.encodeArray(object, depth);
            }
            else if (ArrayBuffer.isView(object)) {
                this.encodeBinary(object);
            }
            else if (typeof object === "object") {
                this.encodeMap(object, depth);
            }
            else {
                // symbol, function and other special object come here unless extensionCodec handles them.
                throw new Error("Unrecognized object: ".concat(Object.prototype.toString.apply(object)));
            }
        };
        Encoder.prototype.encodeBinary = function (object) {
            var size = object.byteLength;
            if (size < 0x100) {
                // bin 8
                this.writeU8(0xc4);
                this.writeU8(size);
            }
            else if (size < 0x10000) {
                // bin 16
                this.writeU8(0xc5);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // bin 32
                this.writeU8(0xc6);
                this.writeU32(size);
            }
            else {
                throw new Error("Too large binary: ".concat(size));
            }
            var bytes = ensureUint8Array(object);
            this.writeU8a(bytes);
        };
        Encoder.prototype.encodeArray = function (object, depth) {
            var size = object.length;
            if (size < 16) {
                // fixarray
                this.writeU8(0x90 + size);
            }
            else if (size < 0x10000) {
                // array 16
                this.writeU8(0xdc);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // array 32
                this.writeU8(0xdd);
                this.writeU32(size);
            }
            else {
                throw new Error("Too large array: ".concat(size));
            }
            for (var _i = 0, object_1 = object; _i < object_1.length; _i++) {
                var item = object_1[_i];
                this.doEncode(item, depth + 1);
            }
        };
        Encoder.prototype.countWithoutUndefined = function (object, keys) {
            var count = 0;
            for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
                var key = keys_1[_i];
                if (object[key] !== undefined) {
                    count++;
                }
            }
            return count;
        };
        Encoder.prototype.encodeMap = function (object, depth) {
            var keys = Object.keys(object);
            if (this.sortKeys) {
                keys.sort();
            }
            var size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
            if (size < 16) {
                // fixmap
                this.writeU8(0x80 + size);
            }
            else if (size < 0x10000) {
                // map 16
                this.writeU8(0xde);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // map 32
                this.writeU8(0xdf);
                this.writeU32(size);
            }
            else {
                throw new Error("Too large map object: ".concat(size));
            }
            for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
                var key = keys_2[_i];
                var value = object[key];
                if (!(this.ignoreUndefined && value === undefined)) {
                    this.encodeString(key);
                    this.doEncode(value, depth + 1);
                }
            }
        };
        Encoder.prototype.encodeExtension = function (ext) {
            var size = ext.data.length;
            if (size === 1) {
                // fixext 1
                this.writeU8(0xd4);
            }
            else if (size === 2) {
                // fixext 2
                this.writeU8(0xd5);
            }
            else if (size === 4) {
                // fixext 4
                this.writeU8(0xd6);
            }
            else if (size === 8) {
                // fixext 8
                this.writeU8(0xd7);
            }
            else if (size === 16) {
                // fixext 16
                this.writeU8(0xd8);
            }
            else if (size < 0x100) {
                // ext 8
                this.writeU8(0xc7);
                this.writeU8(size);
            }
            else if (size < 0x10000) {
                // ext 16
                this.writeU8(0xc8);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // ext 32
                this.writeU8(0xc9);
                this.writeU32(size);
            }
            else {
                throw new Error("Too large extension object: ".concat(size));
            }
            this.writeI8(ext.type);
            this.writeU8a(ext.data);
        };
        Encoder.prototype.writeU8 = function (value) {
            this.ensureBufferSizeToWrite(1);
            this.view.setUint8(this.pos, value);
            this.pos++;
        };
        Encoder.prototype.writeU8a = function (values) {
            var size = values.length;
            this.ensureBufferSizeToWrite(size);
            this.bytes.set(values, this.pos);
            this.pos += size;
        };
        Encoder.prototype.writeI8 = function (value) {
            this.ensureBufferSizeToWrite(1);
            this.view.setInt8(this.pos, value);
            this.pos++;
        };
        Encoder.prototype.writeU16 = function (value) {
            this.ensureBufferSizeToWrite(2);
            this.view.setUint16(this.pos, value);
            this.pos += 2;
        };
        Encoder.prototype.writeI16 = function (value) {
            this.ensureBufferSizeToWrite(2);
            this.view.setInt16(this.pos, value);
            this.pos += 2;
        };
        Encoder.prototype.writeU32 = function (value) {
            this.ensureBufferSizeToWrite(4);
            this.view.setUint32(this.pos, value);
            this.pos += 4;
        };
        Encoder.prototype.writeI32 = function (value) {
            this.ensureBufferSizeToWrite(4);
            this.view.setInt32(this.pos, value);
            this.pos += 4;
        };
        Encoder.prototype.writeF32 = function (value) {
            this.ensureBufferSizeToWrite(4);
            this.view.setFloat32(this.pos, value);
            this.pos += 4;
        };
        Encoder.prototype.writeF64 = function (value) {
            this.ensureBufferSizeToWrite(8);
            this.view.setFloat64(this.pos, value);
            this.pos += 8;
        };
        Encoder.prototype.writeU64 = function (value) {
            this.ensureBufferSizeToWrite(8);
            setUint64(this.view, this.pos, value);
            this.pos += 8;
        };
        Encoder.prototype.writeI64 = function (value) {
            this.ensureBufferSizeToWrite(8);
            setInt64(this.view, this.pos, value);
            this.pos += 8;
        };
        return Encoder;
    }());

    var defaultEncodeOptions = {};
    /**
     * It encodes `value` in the MessagePack format and
     * returns a byte buffer.
     *
     * The returned buffer is a slice of a larger `ArrayBuffer`, so you have to use its `#byteOffset` and `#byteLength` in order to convert it to another typed arrays including NodeJS `Buffer`.
     */
    function encode(value, options) {
        if (options === void 0) { options = defaultEncodeOptions; }
        var encoder = new Encoder(options.extensionCodec, options.context, options.maxDepth, options.initialBufferSize, options.sortKeys, options.forceFloat32, options.ignoreUndefined, options.forceIntegerToFloat);
        return encoder.encodeSharedRef(value);
    }

    function prettyByte(byte) {
        return "".concat(byte < 0 ? "-" : "", "0x").concat(Math.abs(byte).toString(16).padStart(2, "0"));
    }

    var DEFAULT_MAX_KEY_LENGTH = 16;
    var DEFAULT_MAX_LENGTH_PER_KEY = 16;
    var CachedKeyDecoder = /** @class */ (function () {
        function CachedKeyDecoder(maxKeyLength, maxLengthPerKey) {
            if (maxKeyLength === void 0) { maxKeyLength = DEFAULT_MAX_KEY_LENGTH; }
            if (maxLengthPerKey === void 0) { maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY; }
            this.maxKeyLength = maxKeyLength;
            this.maxLengthPerKey = maxLengthPerKey;
            this.hit = 0;
            this.miss = 0;
            // avoid `new Array(N)`, which makes a sparse array,
            // because a sparse array is typically slower than a non-sparse array.
            this.caches = [];
            for (var i = 0; i < this.maxKeyLength; i++) {
                this.caches.push([]);
            }
        }
        CachedKeyDecoder.prototype.canBeCached = function (byteLength) {
            return byteLength > 0 && byteLength <= this.maxKeyLength;
        };
        CachedKeyDecoder.prototype.find = function (bytes, inputOffset, byteLength) {
            var records = this.caches[byteLength - 1];
            FIND_CHUNK: for (var _i = 0, records_1 = records; _i < records_1.length; _i++) {
                var record = records_1[_i];
                var recordBytes = record.bytes;
                for (var j = 0; j < byteLength; j++) {
                    if (recordBytes[j] !== bytes[inputOffset + j]) {
                        continue FIND_CHUNK;
                    }
                }
                return record.str;
            }
            return null;
        };
        CachedKeyDecoder.prototype.store = function (bytes, value) {
            var records = this.caches[bytes.length - 1];
            var record = { bytes: bytes, str: value };
            if (records.length >= this.maxLengthPerKey) {
                // `records` are full!
                // Set `record` to an arbitrary position.
                records[(Math.random() * records.length) | 0] = record;
            }
            else {
                records.push(record);
            }
        };
        CachedKeyDecoder.prototype.decode = function (bytes, inputOffset, byteLength) {
            var cachedValue = this.find(bytes, inputOffset, byteLength);
            if (cachedValue != null) {
                this.hit++;
                return cachedValue;
            }
            this.miss++;
            var str = utf8DecodeJs(bytes, inputOffset, byteLength);
            // Ensure to copy a slice of bytes because the byte may be NodeJS Buffer and Buffer#slice() returns a reference to its internal ArrayBuffer.
            var slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
            this.store(slicedCopyOfBytes, str);
            return str;
        };
        return CachedKeyDecoder;
    }());

    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
    var __asyncValues = (undefined && undefined.__asyncValues) || function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };
    var __await = (undefined && undefined.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); };
    var __asyncGenerator = (undefined && undefined.__asyncGenerator) || function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };
    var isValidMapKeyType = function (key) {
        var keyType = typeof key;
        return keyType === "string" || keyType === "number";
    };
    var HEAD_BYTE_REQUIRED = -1;
    var EMPTY_VIEW = new DataView(new ArrayBuffer(0));
    var EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
    // IE11: Hack to support IE11.
    // IE11: Drop this hack and just use RangeError when IE11 is obsolete.
    var DataViewIndexOutOfBoundsError = (function () {
        try {
            // IE11: The spec says it should throw RangeError,
            // IE11: but in IE11 it throws TypeError.
            EMPTY_VIEW.getInt8(0);
        }
        catch (e) {
            return e.constructor;
        }
        throw new Error("never reached");
    })();
    var MORE_DATA = new DataViewIndexOutOfBoundsError("Insufficient data");
    var sharedCachedKeyDecoder = new CachedKeyDecoder();
    var Decoder = /** @class */ (function () {
        function Decoder(extensionCodec, context, maxStrLength, maxBinLength, maxArrayLength, maxMapLength, maxExtLength, keyDecoder) {
            if (extensionCodec === void 0) { extensionCodec = ExtensionCodec.defaultCodec; }
            if (context === void 0) { context = undefined; }
            if (maxStrLength === void 0) { maxStrLength = UINT32_MAX; }
            if (maxBinLength === void 0) { maxBinLength = UINT32_MAX; }
            if (maxArrayLength === void 0) { maxArrayLength = UINT32_MAX; }
            if (maxMapLength === void 0) { maxMapLength = UINT32_MAX; }
            if (maxExtLength === void 0) { maxExtLength = UINT32_MAX; }
            if (keyDecoder === void 0) { keyDecoder = sharedCachedKeyDecoder; }
            this.extensionCodec = extensionCodec;
            this.context = context;
            this.maxStrLength = maxStrLength;
            this.maxBinLength = maxBinLength;
            this.maxArrayLength = maxArrayLength;
            this.maxMapLength = maxMapLength;
            this.maxExtLength = maxExtLength;
            this.keyDecoder = keyDecoder;
            this.totalPos = 0;
            this.pos = 0;
            this.view = EMPTY_VIEW;
            this.bytes = EMPTY_BYTES;
            this.headByte = HEAD_BYTE_REQUIRED;
            this.stack = [];
        }
        Decoder.prototype.reinitializeState = function () {
            this.totalPos = 0;
            this.headByte = HEAD_BYTE_REQUIRED;
            this.stack.length = 0;
            // view, bytes, and pos will be re-initialized in setBuffer()
        };
        Decoder.prototype.setBuffer = function (buffer) {
            this.bytes = ensureUint8Array(buffer);
            this.view = createDataView(this.bytes);
            this.pos = 0;
        };
        Decoder.prototype.appendBuffer = function (buffer) {
            if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
                this.setBuffer(buffer);
            }
            else {
                var remainingData = this.bytes.subarray(this.pos);
                var newData = ensureUint8Array(buffer);
                // concat remainingData + newData
                var newBuffer = new Uint8Array(remainingData.length + newData.length);
                newBuffer.set(remainingData);
                newBuffer.set(newData, remainingData.length);
                this.setBuffer(newBuffer);
            }
        };
        Decoder.prototype.hasRemaining = function (size) {
            return this.view.byteLength - this.pos >= size;
        };
        Decoder.prototype.createExtraByteError = function (posToShow) {
            var _a = this, view = _a.view, pos = _a.pos;
            return new RangeError("Extra ".concat(view.byteLength - pos, " of ").concat(view.byteLength, " byte(s) found at buffer[").concat(posToShow, "]"));
        };
        /**
         * @throws {@link DecodeError}
         * @throws {@link RangeError}
         */
        Decoder.prototype.decode = function (buffer) {
            this.reinitializeState();
            this.setBuffer(buffer);
            var object = this.doDecodeSync();
            if (this.hasRemaining(1)) {
                throw this.createExtraByteError(this.pos);
            }
            return object;
        };
        Decoder.prototype.decodeMulti = function (buffer) {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.reinitializeState();
                        this.setBuffer(buffer);
                        _a.label = 1;
                    case 1:
                        if (!this.hasRemaining(1)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.doDecodeSync()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/];
                }
            });
        };
        Decoder.prototype.decodeAsync = function (stream) {
            var stream_1, stream_1_1;
            var e_1, _a;
            return __awaiter(this, void 0, void 0, function () {
                var decoded, object, buffer, e_1_1, _b, headByte, pos, totalPos;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            decoded = false;
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 6, 7, 12]);
                            stream_1 = __asyncValues(stream);
                            _c.label = 2;
                        case 2: return [4 /*yield*/, stream_1.next()];
                        case 3:
                            if (!(stream_1_1 = _c.sent(), !stream_1_1.done)) return [3 /*break*/, 5];
                            buffer = stream_1_1.value;
                            if (decoded) {
                                throw this.createExtraByteError(this.totalPos);
                            }
                            this.appendBuffer(buffer);
                            try {
                                object = this.doDecodeSync();
                                decoded = true;
                            }
                            catch (e) {
                                if (!(e instanceof DataViewIndexOutOfBoundsError)) {
                                    throw e; // rethrow
                                }
                                // fallthrough
                            }
                            this.totalPos += this.pos;
                            _c.label = 4;
                        case 4: return [3 /*break*/, 2];
                        case 5: return [3 /*break*/, 12];
                        case 6:
                            e_1_1 = _c.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 12];
                        case 7:
                            _c.trys.push([7, , 10, 11]);
                            if (!(stream_1_1 && !stream_1_1.done && (_a = stream_1.return))) return [3 /*break*/, 9];
                            return [4 /*yield*/, _a.call(stream_1)];
                        case 8:
                            _c.sent();
                            _c.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 11: return [7 /*endfinally*/];
                        case 12:
                            if (decoded) {
                                if (this.hasRemaining(1)) {
                                    throw this.createExtraByteError(this.totalPos);
                                }
                                return [2 /*return*/, object];
                            }
                            _b = this, headByte = _b.headByte, pos = _b.pos, totalPos = _b.totalPos;
                            throw new RangeError("Insufficient data in parsing ".concat(prettyByte(headByte), " at ").concat(totalPos, " (").concat(pos, " in the current buffer)"));
                    }
                });
            });
        };
        Decoder.prototype.decodeArrayStream = function (stream) {
            return this.decodeMultiAsync(stream, true);
        };
        Decoder.prototype.decodeStream = function (stream) {
            return this.decodeMultiAsync(stream, false);
        };
        Decoder.prototype.decodeMultiAsync = function (stream, isArray) {
            return __asyncGenerator(this, arguments, function decodeMultiAsync_1() {
                var isArrayHeaderRequired, arrayItemsLeft, stream_2, stream_2_1, buffer, e_2, e_3_1;
                var e_3, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            isArrayHeaderRequired = isArray;
                            arrayItemsLeft = -1;
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 13, 14, 19]);
                            stream_2 = __asyncValues(stream);
                            _b.label = 2;
                        case 2: return [4 /*yield*/, __await(stream_2.next())];
                        case 3:
                            if (!(stream_2_1 = _b.sent(), !stream_2_1.done)) return [3 /*break*/, 12];
                            buffer = stream_2_1.value;
                            if (isArray && arrayItemsLeft === 0) {
                                throw this.createExtraByteError(this.totalPos);
                            }
                            this.appendBuffer(buffer);
                            if (isArrayHeaderRequired) {
                                arrayItemsLeft = this.readArraySize();
                                isArrayHeaderRequired = false;
                                this.complete();
                            }
                            _b.label = 4;
                        case 4:
                            _b.trys.push([4, 9, , 10]);
                            _b.label = 5;
                        case 5:
                            return [4 /*yield*/, __await(this.doDecodeSync())];
                        case 6: return [4 /*yield*/, _b.sent()];
                        case 7:
                            _b.sent();
                            if (--arrayItemsLeft === 0) {
                                return [3 /*break*/, 8];
                            }
                            return [3 /*break*/, 5];
                        case 8: return [3 /*break*/, 10];
                        case 9:
                            e_2 = _b.sent();
                            if (!(e_2 instanceof DataViewIndexOutOfBoundsError)) {
                                throw e_2; // rethrow
                            }
                            return [3 /*break*/, 10];
                        case 10:
                            this.totalPos += this.pos;
                            _b.label = 11;
                        case 11: return [3 /*break*/, 2];
                        case 12: return [3 /*break*/, 19];
                        case 13:
                            e_3_1 = _b.sent();
                            e_3 = { error: e_3_1 };
                            return [3 /*break*/, 19];
                        case 14:
                            _b.trys.push([14, , 17, 18]);
                            if (!(stream_2_1 && !stream_2_1.done && (_a = stream_2.return))) return [3 /*break*/, 16];
                            return [4 /*yield*/, __await(_a.call(stream_2))];
                        case 15:
                            _b.sent();
                            _b.label = 16;
                        case 16: return [3 /*break*/, 18];
                        case 17:
                            if (e_3) throw e_3.error;
                            return [7 /*endfinally*/];
                        case 18: return [7 /*endfinally*/];
                        case 19: return [2 /*return*/];
                    }
                });
            });
        };
        Decoder.prototype.doDecodeSync = function () {
            DECODE: while (true) {
                var headByte = this.readHeadByte();
                var object = void 0;
                if (headByte >= 0xe0) {
                    // negative fixint (111x xxxx) 0xe0 - 0xff
                    object = headByte - 0x100;
                }
                else if (headByte < 0xc0) {
                    if (headByte < 0x80) {
                        // positive fixint (0xxx xxxx) 0x00 - 0x7f
                        object = headByte;
                    }
                    else if (headByte < 0x90) {
                        // fixmap (1000 xxxx) 0x80 - 0x8f
                        var size = headByte - 0x80;
                        if (size !== 0) {
                            this.pushMapState(size);
                            this.complete();
                            continue DECODE;
                        }
                        else {
                            object = {};
                        }
                    }
                    else if (headByte < 0xa0) {
                        // fixarray (1001 xxxx) 0x90 - 0x9f
                        var size = headByte - 0x90;
                        if (size !== 0) {
                            this.pushArrayState(size);
                            this.complete();
                            continue DECODE;
                        }
                        else {
                            object = [];
                        }
                    }
                    else {
                        // fixstr (101x xxxx) 0xa0 - 0xbf
                        var byteLength = headByte - 0xa0;
                        object = this.decodeUtf8String(byteLength, 0);
                    }
                }
                else if (headByte === 0xc0) {
                    // nil
                    object = null;
                }
                else if (headByte === 0xc2) {
                    // false
                    object = false;
                }
                else if (headByte === 0xc3) {
                    // true
                    object = true;
                }
                else if (headByte === 0xca) {
                    // float 32
                    object = this.readF32();
                }
                else if (headByte === 0xcb) {
                    // float 64
                    object = this.readF64();
                }
                else if (headByte === 0xcc) {
                    // uint 8
                    object = this.readU8();
                }
                else if (headByte === 0xcd) {
                    // uint 16
                    object = this.readU16();
                }
                else if (headByte === 0xce) {
                    // uint 32
                    object = this.readU32();
                }
                else if (headByte === 0xcf) {
                    // uint 64
                    object = this.readU64();
                }
                else if (headByte === 0xd0) {
                    // int 8
                    object = this.readI8();
                }
                else if (headByte === 0xd1) {
                    // int 16
                    object = this.readI16();
                }
                else if (headByte === 0xd2) {
                    // int 32
                    object = this.readI32();
                }
                else if (headByte === 0xd3) {
                    // int 64
                    object = this.readI64();
                }
                else if (headByte === 0xd9) {
                    // str 8
                    var byteLength = this.lookU8();
                    object = this.decodeUtf8String(byteLength, 1);
                }
                else if (headByte === 0xda) {
                    // str 16
                    var byteLength = this.lookU16();
                    object = this.decodeUtf8String(byteLength, 2);
                }
                else if (headByte === 0xdb) {
                    // str 32
                    var byteLength = this.lookU32();
                    object = this.decodeUtf8String(byteLength, 4);
                }
                else if (headByte === 0xdc) {
                    // array 16
                    var size = this.readU16();
                    if (size !== 0) {
                        this.pushArrayState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = [];
                    }
                }
                else if (headByte === 0xdd) {
                    // array 32
                    var size = this.readU32();
                    if (size !== 0) {
                        this.pushArrayState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = [];
                    }
                }
                else if (headByte === 0xde) {
                    // map 16
                    var size = this.readU16();
                    if (size !== 0) {
                        this.pushMapState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = {};
                    }
                }
                else if (headByte === 0xdf) {
                    // map 32
                    var size = this.readU32();
                    if (size !== 0) {
                        this.pushMapState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = {};
                    }
                }
                else if (headByte === 0xc4) {
                    // bin 8
                    var size = this.lookU8();
                    object = this.decodeBinary(size, 1);
                }
                else if (headByte === 0xc5) {
                    // bin 16
                    var size = this.lookU16();
                    object = this.decodeBinary(size, 2);
                }
                else if (headByte === 0xc6) {
                    // bin 32
                    var size = this.lookU32();
                    object = this.decodeBinary(size, 4);
                }
                else if (headByte === 0xd4) {
                    // fixext 1
                    object = this.decodeExtension(1, 0);
                }
                else if (headByte === 0xd5) {
                    // fixext 2
                    object = this.decodeExtension(2, 0);
                }
                else if (headByte === 0xd6) {
                    // fixext 4
                    object = this.decodeExtension(4, 0);
                }
                else if (headByte === 0xd7) {
                    // fixext 8
                    object = this.decodeExtension(8, 0);
                }
                else if (headByte === 0xd8) {
                    // fixext 16
                    object = this.decodeExtension(16, 0);
                }
                else if (headByte === 0xc7) {
                    // ext 8
                    var size = this.lookU8();
                    object = this.decodeExtension(size, 1);
                }
                else if (headByte === 0xc8) {
                    // ext 16
                    var size = this.lookU16();
                    object = this.decodeExtension(size, 2);
                }
                else if (headByte === 0xc9) {
                    // ext 32
                    var size = this.lookU32();
                    object = this.decodeExtension(size, 4);
                }
                else {
                    throw new DecodeError("Unrecognized type byte: ".concat(prettyByte(headByte)));
                }
                this.complete();
                var stack = this.stack;
                while (stack.length > 0) {
                    // arrays and maps
                    var state = stack[stack.length - 1];
                    if (state.type === 0 /* State.ARRAY */) {
                        state.array[state.position] = object;
                        state.position++;
                        if (state.position === state.size) {
                            stack.pop();
                            object = state.array;
                        }
                        else {
                            continue DECODE;
                        }
                    }
                    else if (state.type === 1 /* State.MAP_KEY */) {
                        if (!isValidMapKeyType(object)) {
                            throw new DecodeError("The type of key must be string or number but " + typeof object);
                        }
                        if (object === "__proto__") {
                            throw new DecodeError("The key __proto__ is not allowed");
                        }
                        state.key = object;
                        state.type = 2 /* State.MAP_VALUE */;
                        continue DECODE;
                    }
                    else {
                        // it must be `state.type === State.MAP_VALUE` here
                        state.map[state.key] = object;
                        state.readCount++;
                        if (state.readCount === state.size) {
                            stack.pop();
                            object = state.map;
                        }
                        else {
                            state.key = null;
                            state.type = 1 /* State.MAP_KEY */;
                            continue DECODE;
                        }
                    }
                }
                return object;
            }
        };
        Decoder.prototype.readHeadByte = function () {
            if (this.headByte === HEAD_BYTE_REQUIRED) {
                this.headByte = this.readU8();
                // console.log("headByte", prettyByte(this.headByte));
            }
            return this.headByte;
        };
        Decoder.prototype.complete = function () {
            this.headByte = HEAD_BYTE_REQUIRED;
        };
        Decoder.prototype.readArraySize = function () {
            var headByte = this.readHeadByte();
            switch (headByte) {
                case 0xdc:
                    return this.readU16();
                case 0xdd:
                    return this.readU32();
                default: {
                    if (headByte < 0xa0) {
                        return headByte - 0x90;
                    }
                    else {
                        throw new DecodeError("Unrecognized array type byte: ".concat(prettyByte(headByte)));
                    }
                }
            }
        };
        Decoder.prototype.pushMapState = function (size) {
            if (size > this.maxMapLength) {
                throw new DecodeError("Max length exceeded: map length (".concat(size, ") > maxMapLengthLength (").concat(this.maxMapLength, ")"));
            }
            this.stack.push({
                type: 1 /* State.MAP_KEY */,
                size: size,
                key: null,
                readCount: 0,
                map: {},
            });
        };
        Decoder.prototype.pushArrayState = function (size) {
            if (size > this.maxArrayLength) {
                throw new DecodeError("Max length exceeded: array length (".concat(size, ") > maxArrayLength (").concat(this.maxArrayLength, ")"));
            }
            this.stack.push({
                type: 0 /* State.ARRAY */,
                size: size,
                array: new Array(size),
                position: 0,
            });
        };
        Decoder.prototype.decodeUtf8String = function (byteLength, headerOffset) {
            var _a;
            if (byteLength > this.maxStrLength) {
                throw new DecodeError("Max length exceeded: UTF-8 byte length (".concat(byteLength, ") > maxStrLength (").concat(this.maxStrLength, ")"));
            }
            if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
                throw MORE_DATA;
            }
            var offset = this.pos + headerOffset;
            var object;
            if (this.stateIsMapKey() && ((_a = this.keyDecoder) === null || _a === void 0 ? void 0 : _a.canBeCached(byteLength))) {
                object = this.keyDecoder.decode(this.bytes, offset, byteLength);
            }
            else if (byteLength > TEXT_DECODER_THRESHOLD) {
                object = utf8DecodeTD(this.bytes, offset, byteLength);
            }
            else {
                object = utf8DecodeJs(this.bytes, offset, byteLength);
            }
            this.pos += headerOffset + byteLength;
            return object;
        };
        Decoder.prototype.stateIsMapKey = function () {
            if (this.stack.length > 0) {
                var state = this.stack[this.stack.length - 1];
                return state.type === 1 /* State.MAP_KEY */;
            }
            return false;
        };
        Decoder.prototype.decodeBinary = function (byteLength, headOffset) {
            if (byteLength > this.maxBinLength) {
                throw new DecodeError("Max length exceeded: bin length (".concat(byteLength, ") > maxBinLength (").concat(this.maxBinLength, ")"));
            }
            if (!this.hasRemaining(byteLength + headOffset)) {
                throw MORE_DATA;
            }
            var offset = this.pos + headOffset;
            var object = this.bytes.subarray(offset, offset + byteLength);
            this.pos += headOffset + byteLength;
            return object;
        };
        Decoder.prototype.decodeExtension = function (size, headOffset) {
            if (size > this.maxExtLength) {
                throw new DecodeError("Max length exceeded: ext length (".concat(size, ") > maxExtLength (").concat(this.maxExtLength, ")"));
            }
            var extType = this.view.getInt8(this.pos + headOffset);
            var data = this.decodeBinary(size, headOffset + 1 /* extType */);
            return this.extensionCodec.decode(data, extType, this.context);
        };
        Decoder.prototype.lookU8 = function () {
            return this.view.getUint8(this.pos);
        };
        Decoder.prototype.lookU16 = function () {
            return this.view.getUint16(this.pos);
        };
        Decoder.prototype.lookU32 = function () {
            return this.view.getUint32(this.pos);
        };
        Decoder.prototype.readU8 = function () {
            var value = this.view.getUint8(this.pos);
            this.pos++;
            return value;
        };
        Decoder.prototype.readI8 = function () {
            var value = this.view.getInt8(this.pos);
            this.pos++;
            return value;
        };
        Decoder.prototype.readU16 = function () {
            var value = this.view.getUint16(this.pos);
            this.pos += 2;
            return value;
        };
        Decoder.prototype.readI16 = function () {
            var value = this.view.getInt16(this.pos);
            this.pos += 2;
            return value;
        };
        Decoder.prototype.readU32 = function () {
            var value = this.view.getUint32(this.pos);
            this.pos += 4;
            return value;
        };
        Decoder.prototype.readI32 = function () {
            var value = this.view.getInt32(this.pos);
            this.pos += 4;
            return value;
        };
        Decoder.prototype.readU64 = function () {
            var value = getUint64(this.view, this.pos);
            this.pos += 8;
            return value;
        };
        Decoder.prototype.readI64 = function () {
            var value = getInt64(this.view, this.pos);
            this.pos += 8;
            return value;
        };
        Decoder.prototype.readF32 = function () {
            var value = this.view.getFloat32(this.pos);
            this.pos += 4;
            return value;
        };
        Decoder.prototype.readF64 = function () {
            var value = this.view.getFloat64(this.pos);
            this.pos += 8;
            return value;
        };
        return Decoder;
    }());

    var defaultDecodeOptions = {};
    /**
     * It decodes a single MessagePack object in a buffer.
     *
     * This is a synchronous decoding function.
     * See other variants for asynchronous decoding: {@link decodeAsync()}, {@link decodeStream()}, or {@link decodeArrayStream()}.
     *
     * @throws {@link RangeError} if the buffer is incomplete, including the case where the buffer is empty.
     * @throws {@link DecodeError} if the buffer contains invalid data.
     */
    function decode(buffer, options) {
        if (options === void 0) { options = defaultDecodeOptions; }
        var decoder = new Decoder(options.extensionCodec, options.context, options.maxStrLength, options.maxBinLength, options.maxArrayLength, options.maxMapLength, options.maxExtLength);
        return decoder.decode(buffer);
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    // https://github.com/maxogden/websocket-stream/blob/48dc3ddf943e5ada668c31ccd94e9186f02fafbd/ws-fallback.js

    var ws = null;

    if (typeof WebSocket !== 'undefined') {
      ws = WebSocket;
    } else if (typeof MozWebSocket !== 'undefined') {
      ws = MozWebSocket;
    } else if (typeof commonjsGlobal !== 'undefined') {
      ws = commonjsGlobal.WebSocket || commonjsGlobal.MozWebSocket;
    } else if (typeof window !== 'undefined') {
      ws = window.WebSocket || window.MozWebSocket;
    } else if (typeof self !== 'undefined') {
      ws = self.WebSocket || self.MozWebSocket;
    }

    var browser = ws;

    /**
     * A Websocket client which can make requests and receive responses,
     * as well as send and receive signals
     *
     * Uses Holochain's websocket WireMessage for communication.
     */
    class WsClient {
        socket;
        pendingRequests;
        index;
        alreadyWarnedNoSignalCb;
        constructor(socket, signalCb) {
            this.socket = socket;
            this.pendingRequests = {};
            this.index = 0;
            // TODO: allow adding signal handlers later
            this.alreadyWarnedNoSignalCb = false;
            socket.onmessage = async (encodedMsg) => {
                let data = encodedMsg.data;
                // If data is not a buffer (nodejs), it will be a blob (browser)
                if (typeof Buffer === "undefined" || !Buffer.isBuffer(data)) {
                    data = await data.arrayBuffer();
                }
                const msg = decode(data);
                if (msg.type === "Signal") {
                    if (signalCb) {
                        const decodedMessage = decode(msg.data);
                        if (!decodedMessage.App) {
                            // We have received a system signal, do nothing
                            return;
                        }
                        // Note: holochain currently returns signals as an array of two values: cellId and the serialized signal payload
                        // and this array is nested within the App key within the returned message.
                        const decodedCellId = decodedMessage.App[0];
                        // Note:In order to return readible content to the UI, the signal payload must also be decoded.
                        const decodedPayload = signalTransform(decodedMessage.App[1]);
                        // Return a uniform format to UI (ie: { type, data } - the same format as with callZome and appInfo...)
                        const signal = {
                            type: msg.type,
                            data: { cellId: decodedCellId, payload: decodedPayload },
                        };
                        signalCb(signal);
                    }
                    else {
                        if (!this.alreadyWarnedNoSignalCb)
                            console.log("Received signal but no signal callback was set in constructor");
                        this.alreadyWarnedNoSignalCb = true;
                    }
                }
                else if (msg.type === "Response") {
                    this.handleResponse(msg);
                }
                else {
                    console.error(`Got unrecognized Websocket message type: ${msg.type}`);
                }
            };
        }
        emitSignal(data) {
            const encodedMsg = encode({
                type: "Signal",
                data: encode(data),
            });
            this.socket.send(encodedMsg);
        }
        request(data) {
            const id = this.index;
            this.index += 1;
            const encodedMsg = encode({
                id,
                type: "Request",
                data: encode(data),
            });
            const promise = new Promise((fulfill, reject) => {
                this.pendingRequests[id] = { fulfill, reject };
            });
            if (this.socket.readyState === this.socket.OPEN) {
                this.socket.send(encodedMsg);
            }
            else {
                return Promise.reject(new Error("Socket is not open"));
            }
            return promise;
        }
        handleResponse(msg) {
            const id = msg.id;
            if (this.pendingRequests[id]) {
                // resolve response
                if (msg.data === null || msg.data === undefined) {
                    this.pendingRequests[id].reject(new Error("Response canceled by responder"));
                }
                else {
                    this.pendingRequests[id].fulfill(decode(msg.data));
                }
            }
            else {
                console.error(`Got response with no matching request. id=${id}`);
            }
        }
        close() {
            this.socket.close();
            return this.awaitClose();
        }
        awaitClose() {
            return new Promise((resolve) => this.socket.on("close", resolve));
        }
        static connect(url, signalCb) {
            return new Promise((resolve, reject) => {
                const socket = new browser(url);
                // make sure that there are no uncaught connection
                // errors because that causes nodejs thread to crash
                // with uncaught exception
                socket.onerror = () => {
                    reject(new Error(`could not connect to holochain conductor, please check that a conductor service is running and available at ${url}`));
                };
                socket.onopen = () => {
                    resolve(new WsClient(socket, signalCb));
                };
            });
        }
    }
    const signalTransform = (res) => {
        return decode(res);
    };

    const ERROR_TYPE = "error";
    const DEFAULT_TIMEOUT = 15000;
    /**
     * Take a Requester function which deals with tagged requests and responses,
     * and return a Requester which deals only with the inner data types, also
     * with the optional Transformer applied to further modify the input and output.
     */
    const requesterTransformer = (requester, tag, transform = identityTransformer) => async (req, timeout) => {
        const input = { type: tag, data: transform.input(req) };
        const response = await requester(input, timeout);
        const output = transform.output(response.data);
        return output;
    };
    const identity = (x) => x;
    const identityTransformer = {
        input: identity,
        output: identity,
    };
    const catchError = (res) => {
        return res.type === ERROR_TYPE ? Promise.reject(res) : Promise.resolve(res);
    };
    const promiseTimeout = (promise, tag, ms) => {
        let id;
        const timeout = new Promise((_, reject) => {
            id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error(`Timed out in ${ms}ms: ${tag}`));
            }, ms);
        });
        return new Promise((res, rej) => {
            Promise.race([promise, timeout])
                .then((a) => {
                clearTimeout(id);
                return res(a);
            })
                .catch((e) => {
                return rej(e);
            });
        });
    };

    var browserPonyfill = createCommonjsModule(function (module, exports) {
    var global = typeof self !== 'undefined' ? self : commonjsGlobal;
    var __self__ = (function () {
    function F() {
    this.fetch = false;
    this.DOMException = global.DOMException;
    }
    F.prototype = global;
    return new F();
    })();
    (function(self) {

    ((function (exports) {

      var support = {
        searchParams: 'URLSearchParams' in self,
        iterable: 'Symbol' in self && 'iterator' in Symbol,
        blob:
          'FileReader' in self &&
          'Blob' in self &&
          (function() {
            try {
              new Blob();
              return true
            } catch (e) {
              return false
            }
          })(),
        formData: 'FormData' in self,
        arrayBuffer: 'ArrayBuffer' in self
      };

      function isDataView(obj) {
        return obj && DataView.prototype.isPrototypeOf(obj)
      }

      if (support.arrayBuffer) {
        var viewClasses = [
          '[object Int8Array]',
          '[object Uint8Array]',
          '[object Uint8ClampedArray]',
          '[object Int16Array]',
          '[object Uint16Array]',
          '[object Int32Array]',
          '[object Uint32Array]',
          '[object Float32Array]',
          '[object Float64Array]'
        ];

        var isArrayBufferView =
          ArrayBuffer.isView ||
          function(obj) {
            return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
          };
      }

      function normalizeName(name) {
        if (typeof name !== 'string') {
          name = String(name);
        }
        if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(name)) {
          throw new TypeError('Invalid character in header field name')
        }
        return name.toLowerCase()
      }

      function normalizeValue(value) {
        if (typeof value !== 'string') {
          value = String(value);
        }
        return value
      }

      // Build a destructive iterator for the value list
      function iteratorFor(items) {
        var iterator = {
          next: function() {
            var value = items.shift();
            return {done: value === undefined, value: value}
          }
        };

        if (support.iterable) {
          iterator[Symbol.iterator] = function() {
            return iterator
          };
        }

        return iterator
      }

      function Headers(headers) {
        this.map = {};

        if (headers instanceof Headers) {
          headers.forEach(function(value, name) {
            this.append(name, value);
          }, this);
        } else if (Array.isArray(headers)) {
          headers.forEach(function(header) {
            this.append(header[0], header[1]);
          }, this);
        } else if (headers) {
          Object.getOwnPropertyNames(headers).forEach(function(name) {
            this.append(name, headers[name]);
          }, this);
        }
      }

      Headers.prototype.append = function(name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);
        var oldValue = this.map[name];
        this.map[name] = oldValue ? oldValue + ', ' + value : value;
      };

      Headers.prototype['delete'] = function(name) {
        delete this.map[normalizeName(name)];
      };

      Headers.prototype.get = function(name) {
        name = normalizeName(name);
        return this.has(name) ? this.map[name] : null
      };

      Headers.prototype.has = function(name) {
        return this.map.hasOwnProperty(normalizeName(name))
      };

      Headers.prototype.set = function(name, value) {
        this.map[normalizeName(name)] = normalizeValue(value);
      };

      Headers.prototype.forEach = function(callback, thisArg) {
        for (var name in this.map) {
          if (this.map.hasOwnProperty(name)) {
            callback.call(thisArg, this.map[name], name, this);
          }
        }
      };

      Headers.prototype.keys = function() {
        var items = [];
        this.forEach(function(value, name) {
          items.push(name);
        });
        return iteratorFor(items)
      };

      Headers.prototype.values = function() {
        var items = [];
        this.forEach(function(value) {
          items.push(value);
        });
        return iteratorFor(items)
      };

      Headers.prototype.entries = function() {
        var items = [];
        this.forEach(function(value, name) {
          items.push([name, value]);
        });
        return iteratorFor(items)
      };

      if (support.iterable) {
        Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
      }

      function consumed(body) {
        if (body.bodyUsed) {
          return Promise.reject(new TypeError('Already read'))
        }
        body.bodyUsed = true;
      }

      function fileReaderReady(reader) {
        return new Promise(function(resolve, reject) {
          reader.onload = function() {
            resolve(reader.result);
          };
          reader.onerror = function() {
            reject(reader.error);
          };
        })
      }

      function readBlobAsArrayBuffer(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsArrayBuffer(blob);
        return promise
      }

      function readBlobAsText(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsText(blob);
        return promise
      }

      function readArrayBufferAsText(buf) {
        var view = new Uint8Array(buf);
        var chars = new Array(view.length);

        for (var i = 0; i < view.length; i++) {
          chars[i] = String.fromCharCode(view[i]);
        }
        return chars.join('')
      }

      function bufferClone(buf) {
        if (buf.slice) {
          return buf.slice(0)
        } else {
          var view = new Uint8Array(buf.byteLength);
          view.set(new Uint8Array(buf));
          return view.buffer
        }
      }

      function Body() {
        this.bodyUsed = false;

        this._initBody = function(body) {
          this._bodyInit = body;
          if (!body) {
            this._bodyText = '';
          } else if (typeof body === 'string') {
            this._bodyText = body;
          } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            this._bodyBlob = body;
          } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            this._bodyFormData = body;
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this._bodyText = body.toString();
          } else if (support.arrayBuffer && support.blob && isDataView(body)) {
            this._bodyArrayBuffer = bufferClone(body.buffer);
            // IE 10-11 can't handle a DataView body.
            this._bodyInit = new Blob([this._bodyArrayBuffer]);
          } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
            this._bodyArrayBuffer = bufferClone(body);
          } else {
            this._bodyText = body = Object.prototype.toString.call(body);
          }

          if (!this.headers.get('content-type')) {
            if (typeof body === 'string') {
              this.headers.set('content-type', 'text/plain;charset=UTF-8');
            } else if (this._bodyBlob && this._bodyBlob.type) {
              this.headers.set('content-type', this._bodyBlob.type);
            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
              this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
            }
          }
        };

        if (support.blob) {
          this.blob = function() {
            var rejected = consumed(this);
            if (rejected) {
              return rejected
            }

            if (this._bodyBlob) {
              return Promise.resolve(this._bodyBlob)
            } else if (this._bodyArrayBuffer) {
              return Promise.resolve(new Blob([this._bodyArrayBuffer]))
            } else if (this._bodyFormData) {
              throw new Error('could not read FormData body as blob')
            } else {
              return Promise.resolve(new Blob([this._bodyText]))
            }
          };

          this.arrayBuffer = function() {
            if (this._bodyArrayBuffer) {
              return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
            } else {
              return this.blob().then(readBlobAsArrayBuffer)
            }
          };
        }

        this.text = function() {
          var rejected = consumed(this);
          if (rejected) {
            return rejected
          }

          if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob)
          } else if (this._bodyArrayBuffer) {
            return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as text')
          } else {
            return Promise.resolve(this._bodyText)
          }
        };

        if (support.formData) {
          this.formData = function() {
            return this.text().then(decode)
          };
        }

        this.json = function() {
          return this.text().then(JSON.parse)
        };

        return this
      }

      // HTTP methods whose capitalization should be normalized
      var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

      function normalizeMethod(method) {
        var upcased = method.toUpperCase();
        return methods.indexOf(upcased) > -1 ? upcased : method
      }

      function Request(input, options) {
        options = options || {};
        var body = options.body;

        if (input instanceof Request) {
          if (input.bodyUsed) {
            throw new TypeError('Already read')
          }
          this.url = input.url;
          this.credentials = input.credentials;
          if (!options.headers) {
            this.headers = new Headers(input.headers);
          }
          this.method = input.method;
          this.mode = input.mode;
          this.signal = input.signal;
          if (!body && input._bodyInit != null) {
            body = input._bodyInit;
            input.bodyUsed = true;
          }
        } else {
          this.url = String(input);
        }

        this.credentials = options.credentials || this.credentials || 'same-origin';
        if (options.headers || !this.headers) {
          this.headers = new Headers(options.headers);
        }
        this.method = normalizeMethod(options.method || this.method || 'GET');
        this.mode = options.mode || this.mode || null;
        this.signal = options.signal || this.signal;
        this.referrer = null;

        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
          throw new TypeError('Body not allowed for GET or HEAD requests')
        }
        this._initBody(body);
      }

      Request.prototype.clone = function() {
        return new Request(this, {body: this._bodyInit})
      };

      function decode(body) {
        var form = new FormData();
        body
          .trim()
          .split('&')
          .forEach(function(bytes) {
            if (bytes) {
              var split = bytes.split('=');
              var name = split.shift().replace(/\+/g, ' ');
              var value = split.join('=').replace(/\+/g, ' ');
              form.append(decodeURIComponent(name), decodeURIComponent(value));
            }
          });
        return form
      }

      function parseHeaders(rawHeaders) {
        var headers = new Headers();
        // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
        // https://tools.ietf.org/html/rfc7230#section-3.2
        var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
        preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
          var parts = line.split(':');
          var key = parts.shift().trim();
          if (key) {
            var value = parts.join(':').trim();
            headers.append(key, value);
          }
        });
        return headers
      }

      Body.call(Request.prototype);

      function Response(bodyInit, options) {
        if (!options) {
          options = {};
        }

        this.type = 'default';
        this.status = options.status === undefined ? 200 : options.status;
        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = 'statusText' in options ? options.statusText : 'OK';
        this.headers = new Headers(options.headers);
        this.url = options.url || '';
        this._initBody(bodyInit);
      }

      Body.call(Response.prototype);

      Response.prototype.clone = function() {
        return new Response(this._bodyInit, {
          status: this.status,
          statusText: this.statusText,
          headers: new Headers(this.headers),
          url: this.url
        })
      };

      Response.error = function() {
        var response = new Response(null, {status: 0, statusText: ''});
        response.type = 'error';
        return response
      };

      var redirectStatuses = [301, 302, 303, 307, 308];

      Response.redirect = function(url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
          throw new RangeError('Invalid status code')
        }

        return new Response(null, {status: status, headers: {location: url}})
      };

      exports.DOMException = self.DOMException;
      try {
        new exports.DOMException();
      } catch (err) {
        exports.DOMException = function(message, name) {
          this.message = message;
          this.name = name;
          var error = Error(message);
          this.stack = error.stack;
        };
        exports.DOMException.prototype = Object.create(Error.prototype);
        exports.DOMException.prototype.constructor = exports.DOMException;
      }

      function fetch(input, init) {
        return new Promise(function(resolve, reject) {
          var request = new Request(input, init);

          if (request.signal && request.signal.aborted) {
            return reject(new exports.DOMException('Aborted', 'AbortError'))
          }

          var xhr = new XMLHttpRequest();

          function abortXhr() {
            xhr.abort();
          }

          xhr.onload = function() {
            var options = {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseHeaders(xhr.getAllResponseHeaders() || '')
            };
            options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
            var body = 'response' in xhr ? xhr.response : xhr.responseText;
            resolve(new Response(body, options));
          };

          xhr.onerror = function() {
            reject(new TypeError('Network request failed'));
          };

          xhr.ontimeout = function() {
            reject(new TypeError('Network request failed'));
          };

          xhr.onabort = function() {
            reject(new exports.DOMException('Aborted', 'AbortError'));
          };

          xhr.open(request.method, request.url, true);

          if (request.credentials === 'include') {
            xhr.withCredentials = true;
          } else if (request.credentials === 'omit') {
            xhr.withCredentials = false;
          }

          if ('responseType' in xhr && support.blob) {
            xhr.responseType = 'blob';
          }

          request.headers.forEach(function(value, name) {
            xhr.setRequestHeader(name, value);
          });

          if (request.signal) {
            request.signal.addEventListener('abort', abortXhr);

            xhr.onreadystatechange = function() {
              // DONE (success or failure)
              if (xhr.readyState === 4) {
                request.signal.removeEventListener('abort', abortXhr);
              }
            };
          }

          xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
        })
      }

      fetch.polyfill = true;

      if (!self.fetch) {
        self.fetch = fetch;
        self.Headers = Headers;
        self.Request = Request;
        self.Response = Response;
      }

      exports.Headers = Headers;
      exports.Request = Request;
      exports.Response = Response;
      exports.fetch = fetch;

      Object.defineProperty(exports, '__esModule', { value: true });

      return exports;

    }))({});
    })(__self__);
    __self__.fetch.ponyfill = true;
    // Remove "polyfill" property added by whatwg-fetch
    delete __self__.fetch.polyfill;
    // Choose between native implementation (global) or custom implementation (__self__)
    // var ctx = global.fetch ? global : __self__;
    var ctx = __self__; // this line disable service worker support temporarily
    exports = ctx.fetch; // To enable: import fetch from 'cross-fetch'
    exports.default = ctx.fetch; // For TypeScript consumers without esModuleInterop.
    exports.fetch = ctx.fetch; // To enable: import {fetch} from 'cross-fetch'
    exports.Headers = ctx.Headers;
    exports.Request = ctx.Request;
    exports.Response = ctx.Response;
    module.exports = exports;
    });

    var fetch = /*@__PURE__*/getDefaultExportFromCjs(browserPonyfill);

    // This is based on
    // https://github.com/holochain/launcher/blob/213aae208c58f2496811d80859723b71f6750426/crates/holochain_web_app_manager/src/caddy/utils.rs#L49
    const LAUNCHER_ENV_URL = "/.launcher-env.json";
    async function fetchLauncherEnvironment() {
        const env = await fetch(LAUNCHER_ENV_URL);
        if (env.ok) {
            const launcherEnvironment = await env.json();
            return launcherEnvironment;
        }
        else {
            // We are not in the launcher environment
            if (env.status === 404) {
                console.warn("[@holochain/conductor-api]: you are in a development environment. When this UI is run in the Holochain Launcher, `AppWebsocket.connect()`, `AdminWebsocket.connect()` and `appWebsocket.appInfo()` will have their parameters ignored and substituted by the ones provided by the Holochain Launcher.");
                return undefined;
            }
            else {
                throw new Error(`Error trying to fetch the launcher environment: ${env.statusText}`);
            }
        }
    }
    const isBrowser = typeof window !== "undefined";
    const isJest = typeof process !== "undefined" &&
        process.env &&
        process.env.JEST_WORKER_ID !== undefined;
    let promise;
    if (isBrowser && !isJest) {
        promise = fetchLauncherEnvironment().catch(console.error);
    }
    async function getLauncherEnvironment() {
        if (isBrowser) {
            return promise;
        }
        else {
            return undefined;
        }
    }

    /**
     * Defines AppWebsocket, an easy-to-use websocket implementation of the
     * Conductor API for apps
     *
     *    const client = AppWebsocket.connect(
     *      'ws://localhost:9000',
     *      signal => console.log('got a signal:', signal)
     *    )
     *
     *    client.callZome({...})  // TODO: show what's in here
     *      .then(() => {
     *        console.log('DNA successfully installed')
     *      })
     *      .catch(err => {
     *        console.error('problem installing DNA:', err)
     *      })
     */
    class AppWebsocket {
        client;
        defaultTimeout;
        overrideInstalledAppId;
        constructor(client, defaultTimeout, overrideInstalledAppId) {
            this.client = client;
            this.defaultTimeout =
                defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout;
            this.overrideInstalledAppId = overrideInstalledAppId;
        }
        static async connect(url, defaultTimeout, signalCb) {
            // Check if we are in the launcher's environment, and if so, redirect the url to connect to
            const env = await getLauncherEnvironment();
            if (env) {
                url = `ws://localhost:${env.APP_INTERFACE_PORT}`;
            }
            const wsClient = await WsClient.connect(url, signalCb);
            return new AppWebsocket(wsClient, defaultTimeout, env ? env.INSTALLED_APP_ID : undefined);
        }
        _requester = (tag, transformer) => requesterTransformer((req, timeout) => promiseTimeout(this.client.request(req), tag, timeout || this.defaultTimeout).then(catchError), tag, transformer);
        appInfo = this._requester("app_info", appInfoTransform(this));
        callZome = this._requester("zome_call", callZomeTransform);
    }
    const callZomeTransform = {
        input: (req) => {
            return {
                ...req,
                payload: encode(req.payload),
            };
        },
        output: (res) => {
            return decode(res);
        },
    };
    const appInfoTransform = (appWs) => ({
        input: (req) => {
            if (appWs.overrideInstalledAppId) {
                return {
                    installed_app_id: appWs.overrideInstalledAppId,
                };
            }
            return req;
        },
        output: (res) => {
            return res;
        },
    });

    var ActionType;
    (function (ActionType) {
        ActionType["Dna"] = "Dna";
        ActionType["AgentValidationPkg"] = "AgentValidationPkg";
        ActionType["InitZomesComplete"] = "InitZomesComplete";
        ActionType["CreateLink"] = "CreateLink";
        ActionType["DeleteLink"] = "DeleteLink";
        ActionType["OpenChain"] = "OpenChain";
        ActionType["CloseChain"] = "CloseChain";
        ActionType["Create"] = "Create";
        ActionType["Update"] = "Update";
        ActionType["Delete"] = "Delete";
    })(ActionType || (ActionType = {}));

    // https://github.com/holochain/holochain/blob/develop/crates/types/src/dht_op.rs
    var DhtOpType;
    (function (DhtOpType) {
        DhtOpType["StoreRecord"] = "StoreRecord";
        DhtOpType["StoreEntry"] = "StoreEntry";
        DhtOpType["RegisterAgentActivity"] = "RegisterAgentActivity";
        DhtOpType["RegisterUpdatedContent"] = "RegisterUpdatedContent";
        DhtOpType["RegisterUpdatedRecord"] = "RegisterUpdatedRecord";
        DhtOpType["RegisterDeletedBy"] = "RegisterDeletedBy";
        DhtOpType["RegisterDeletedEntryAction"] = "RegisterDeletedEntryAction";
        DhtOpType["RegisterAddLink"] = "RegisterAddLink";
        DhtOpType["RegisterRemoveLink"] = "RegisterRemoveLink";
    })(DhtOpType || (DhtOpType = {}));

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$7(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    const e$a=e=>n=>"function"==typeof n?((e,n)=>(customElements.define(e,n),n))(e,n):((e,n)=>{const{kind:t,elements:s}=n;return {kind:t,elements:s,finisher(n){customElements.define(e,n);}}})(e,n);

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    const i$5=(i,e)=>"method"===e.kind&&e.descriptor&&!("value"in e.descriptor)?{...e,finisher(n){n.createProperty(e.key,i);}}:{kind:"field",key:Symbol(),placement:"own",descriptor:{},originalKey:e.key,initializer(){"function"==typeof e.initializer&&(this[e.key]=e.initializer.call(this));},finisher(n){n.createProperty(e.key,i);}};function e$9(e){return (n,t)=>void 0!==t?((i,e,n)=>{e.constructor.createProperty(n,i);})(e,n,t):i$5(e,n)}

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */function t$4(t){return e$9({...t,state:!0})}

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    const o$7=({finisher:e,descriptor:t})=>(o,n)=>{var r;if(void 0===n){const n=null!==(r=o.originalKey)&&void 0!==r?r:o.key,i=null!=t?{kind:"method",placement:"prototype",key:n,descriptor:t(o.key)}:{...o,key:n};return null!=e&&(i.finisher=function(t){e(t,n);}),i}{const r=o.constructor;void 0!==t&&Object.defineProperty(o,n,t(n)),null==e||e(r,n);}};

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */function e$8(e){return o$7({finisher:(r,t)=>{Object.assign(r.prototype[t],e);}})}

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */function i$4(i,n){return o$7({descriptor:o=>{const t={get(){var o,n;return null!==(n=null===(o=this.renderRoot)||void 0===o?void 0:o.querySelector(i))&&void 0!==n?n:null},enumerable:!0,configurable:!0};if(n){const n="symbol"==typeof o?Symbol():"__"+o;t.get=function(){var o,t;return void 0===this[n]&&(this[n]=null!==(t=null===(o=this.renderRoot)||void 0===o?void 0:o.querySelector(i))&&void 0!==t?t:null),this[n]};}return t}})}

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    function e$7(e){return o$7({descriptor:r=>({async get(){var r;return await this.updateComplete,null===(r=this.renderRoot)||void 0===r?void 0:r.querySelector(e)},enumerable:!0,configurable:!0})})}

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */var n$6;null!=(null===(n$6=window.HTMLSlotElement)||void 0===n$6?void 0:n$6.prototype.assignedElements)?(o,n)=>o.assignedElements(n):(o,n)=>o.assignedNodes(n).filter((o=>o.nodeType===Node.ELEMENT_NODE));

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /**
     * TypeScript version of the decorator
     * @see https://www.typescriptlang.org/docs/handbook/decorators.html#property-decorators
     */
    function tsDecorator(prototype, name, descriptor) {
        const constructor = prototype.constructor;
        if (!descriptor) {
            /**
             * lit uses internal properties with two leading underscores to
             * provide storage for accessors
             */
            const litInternalPropertyKey = `__${name}`;
            descriptor =
                constructor.getPropertyDescriptor(name, litInternalPropertyKey);
            if (!descriptor) {
                throw new Error('@ariaProperty must be used after a @property decorator');
            }
        }
        // descriptor must exist at this point, reassign so typescript understands
        const propDescriptor = descriptor;
        let attribute = '';
        if (!propDescriptor.set) {
            throw new Error(`@ariaProperty requires a setter for ${name}`);
        }
        // TODO(b/202853219): Remove this check when internal tooling is
        // compatible
        // tslint:disable-next-line:no-any bail if applied to internal generated class
        if (prototype.dispatchWizEvent) {
            return descriptor;
        }
        const wrappedDescriptor = {
            configurable: true,
            enumerable: true,
            set(value) {
                if (attribute === '') {
                    const options = constructor.getPropertyOptions(name);
                    // if attribute is not a string, use `name` instead
                    attribute =
                        typeof options.attribute === 'string' ? options.attribute : name;
                }
                if (this.hasAttribute(attribute)) {
                    this.removeAttribute(attribute);
                }
                propDescriptor.set.call(this, value);
            }
        };
        if (propDescriptor.get) {
            wrappedDescriptor.get = function () {
                return propDescriptor.get.call(this);
            };
        }
        return wrappedDescriptor;
    }
    /**
     * A property decorator proxies an aria attribute to an internal node
     *
     * This decorator is only intended for use with ARIA attributes, such as `role`
     * and `aria-label` due to screenreader needs.
     *
     * Upon first render, `@ariaProperty` will remove the attribute from the host
     * element to prevent screenreaders from reading the host instead of the
     * internal node.
     *
     * This decorator should only be used for non-Symbol public fields decorated
     * with `@property`, or on a setter with an optional getter.
     *
     * @example
     * ```ts
     * class MyElement {
     *   @ariaProperty
     *   @property({ type: String, attribute: 'aria-label' })
     *   ariaLabel!: string;
     * }
     * ```
     * @category Decorator
     * @ExportDecoratedItems
     */
    function ariaProperty(protoOrDescriptor, name, 
    // tslint:disable-next-line:no-any any is required as a return type from decorators
    descriptor) {
        if (name !== undefined) {
            return tsDecorator(protoOrDescriptor, name, descriptor);
        }
        else {
            throw new Error('@ariaProperty only supports TypeScript Decorators');
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    const t$3=window,e$6=t$3.ShadowRoot&&(void 0===t$3.ShadyCSS||t$3.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s$6=Symbol(),n$5=new WeakMap;class o$6{constructor(t,e,n){if(this._$cssResult$=!0,n!==s$6)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e;}get styleSheet(){let t=this.o;const s=this.t;if(e$6&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=n$5.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&n$5.set(s,t));}return t}toString(){return this.cssText}}const r$4=t=>new o$6("string"==typeof t?t:t+"",void 0,s$6),S$2=(s,n)=>{e$6?s.adoptedStyleSheets=n.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet)):n.forEach((e=>{const n=document.createElement("style"),o=t$3.litNonce;void 0!==o&&n.setAttribute("nonce",o),n.textContent=e.cssText,s.appendChild(n);}));},c$2=e$6?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return r$4(e)})(t):t;

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */var s$5;const e$5=window,r$3=e$5.trustedTypes,h$2=r$3?r$3.emptyScript:"",o$5=e$5.reactiveElementPolyfillSupport,n$4={toAttribute(t,i){switch(i){case Boolean:t=t?h$2:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,i){let s=t;switch(i){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t);}catch(t){s=null;}}return s}},a$2=(t,i)=>i!==t&&(i==i||t==t),l$5={attribute:!0,type:String,converter:n$4,reflect:!1,hasChanged:a$2};class d$2 extends HTMLElement{constructor(){super(),this._$Ei=new Map,this.isUpdatePending=!1,this.hasUpdated=!1,this._$El=null,this.u();}static addInitializer(t){var i;null!==(i=this.h)&&void 0!==i||(this.h=[]),this.h.push(t);}static get observedAttributes(){this.finalize();const t=[];return this.elementProperties.forEach(((i,s)=>{const e=this._$Ep(s,i);void 0!==e&&(this._$Ev.set(e,s),t.push(e));})),t}static createProperty(t,i=l$5){if(i.state&&(i.attribute=!1),this.finalize(),this.elementProperties.set(t,i),!i.noAccessor&&!this.prototype.hasOwnProperty(t)){const s="symbol"==typeof t?Symbol():"__"+t,e=this.getPropertyDescriptor(t,s,i);void 0!==e&&Object.defineProperty(this.prototype,t,e);}}static getPropertyDescriptor(t,i,s){return {get(){return this[i]},set(e){const r=this[t];this[i]=e,this.requestUpdate(t,r,s);},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)||l$5}static finalize(){if(this.hasOwnProperty("finalized"))return !1;this.finalized=!0;const t=Object.getPrototypeOf(this);if(t.finalize(),this.elementProperties=new Map(t.elementProperties),this._$Ev=new Map,this.hasOwnProperty("properties")){const t=this.properties,i=[...Object.getOwnPropertyNames(t),...Object.getOwnPropertySymbols(t)];for(const s of i)this.createProperty(s,t[s]);}return this.elementStyles=this.finalizeStyles(this.styles),!0}static finalizeStyles(i){const s=[];if(Array.isArray(i)){const e=new Set(i.flat(1/0).reverse());for(const i of e)s.unshift(c$2(i));}else void 0!==i&&s.push(c$2(i));return s}static _$Ep(t,i){const s=i.attribute;return !1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}u(){var t;this._$E_=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$Eg(),this.requestUpdate(),null===(t=this.constructor.h)||void 0===t||t.forEach((t=>t(this)));}addController(t){var i,s;(null!==(i=this._$ES)&&void 0!==i?i:this._$ES=[]).push(t),void 0!==this.renderRoot&&this.isConnected&&(null===(s=t.hostConnected)||void 0===s||s.call(t));}removeController(t){var i;null===(i=this._$ES)||void 0===i||i.splice(this._$ES.indexOf(t)>>>0,1);}_$Eg(){this.constructor.elementProperties.forEach(((t,i)=>{this.hasOwnProperty(i)&&(this._$Ei.set(i,this[i]),delete this[i]);}));}createRenderRoot(){var t;const s=null!==(t=this.shadowRoot)&&void 0!==t?t:this.attachShadow(this.constructor.shadowRootOptions);return S$2(s,this.constructor.elementStyles),s}connectedCallback(){var t;void 0===this.renderRoot&&(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null===(t=this._$ES)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostConnected)||void 0===i?void 0:i.call(t)}));}enableUpdating(t){}disconnectedCallback(){var t;null===(t=this._$ES)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostDisconnected)||void 0===i?void 0:i.call(t)}));}attributeChangedCallback(t,i,s){this._$AK(t,s);}_$EO(t,i,s=l$5){var e;const r=this.constructor._$Ep(t,s);if(void 0!==r&&!0===s.reflect){const h=(void 0!==(null===(e=s.converter)||void 0===e?void 0:e.toAttribute)?s.converter:n$4).toAttribute(i,s.type);this._$El=t,null==h?this.removeAttribute(r):this.setAttribute(r,h),this._$El=null;}}_$AK(t,i){var s;const e=this.constructor,r=e._$Ev.get(t);if(void 0!==r&&this._$El!==r){const t=e.getPropertyOptions(r),h="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==(null===(s=t.converter)||void 0===s?void 0:s.fromAttribute)?t.converter:n$4;this._$El=r,this[r]=h.fromAttribute(i,t.type),this._$El=null;}}requestUpdate(t,i,s){let e=!0;void 0!==t&&(((s=s||this.constructor.getPropertyOptions(t)).hasChanged||a$2)(this[t],i)?(this._$AL.has(t)||this._$AL.set(t,i),!0===s.reflect&&this._$El!==t&&(void 0===this._$EC&&(this._$EC=new Map),this._$EC.set(t,s))):e=!1),!this.isUpdatePending&&e&&(this._$E_=this._$Ej());}async _$Ej(){this.isUpdatePending=!0;try{await this._$E_;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;this.hasUpdated,this._$Ei&&(this._$Ei.forEach(((t,i)=>this[i]=t)),this._$Ei=void 0);let i=!1;const s=this._$AL;try{i=this.shouldUpdate(s),i?(this.willUpdate(s),null===(t=this._$ES)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostUpdate)||void 0===i?void 0:i.call(t)})),this.update(s)):this._$Ek();}catch(t){throw i=!1,this._$Ek(),t}i&&this._$AE(s);}willUpdate(t){}_$AE(t){var i;null===(i=this._$ES)||void 0===i||i.forEach((t=>{var i;return null===(i=t.hostUpdated)||void 0===i?void 0:i.call(t)})),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t);}_$Ek(){this._$AL=new Map,this.isUpdatePending=!1;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$E_}shouldUpdate(t){return !0}update(t){void 0!==this._$EC&&(this._$EC.forEach(((t,i)=>this._$EO(i,this[i],t))),this._$EC=void 0),this._$Ek();}updated(t){}firstUpdated(t){}}d$2.finalized=!0,d$2.elementProperties=new Map,d$2.elementStyles=[],d$2.shadowRootOptions={mode:"open"},null==o$5||o$5({ReactiveElement:d$2}),(null!==(s$5=e$5.reactiveElementVersions)&&void 0!==s$5?s$5:e$5.reactiveElementVersions=[]).push("1.4.1");

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    var t$2;const i$3=window,s$4=i$3.trustedTypes,e$4=s$4?s$4.createPolicy("lit-html",{createHTML:t=>t}):void 0,o$4=`lit$${(Math.random()+"").slice(9)}$`,n$3="?"+o$4,l$4=`<${n$3}>`,h$1=document,r$2=(t="")=>h$1.createComment(t),d$1=t=>null===t||"object"!=typeof t&&"function"!=typeof t,u=Array.isArray,c$1=t=>u(t)||"function"==typeof(null==t?void 0:t[Symbol.iterator]),v=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,a$1=/-->/g,f$1=/>/g,_=RegExp(">|[ \t\n\f\r](?:([^\\s\"'>=/]+)([ \t\n\f\r]*=[ \t\n\f\r]*(?:[^ \t\n\f\r\"'`<>=]|(\"|')|))|$)","g"),m=/'/g,p=/"/g,$=/^(?:script|style|textarea|title)$/i,g=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),y=g(1),x=Symbol.for("lit-noChange"),b=Symbol.for("lit-nothing"),T=new WeakMap,A=h$1.createTreeWalker(h$1,129,null,!1),E=(t,i)=>{const s=t.length-1,n=[];let h,r=2===i?"<svg>":"",d=v;for(let i=0;i<s;i++){const s=t[i];let e,u,c=-1,g=0;for(;g<s.length&&(d.lastIndex=g,u=d.exec(s),null!==u);)g=d.lastIndex,d===v?"!--"===u[1]?d=a$1:void 0!==u[1]?d=f$1:void 0!==u[2]?($.test(u[2])&&(h=RegExp("</"+u[2],"g")),d=_):void 0!==u[3]&&(d=_):d===_?">"===u[0]?(d=null!=h?h:v,c=-1):void 0===u[1]?c=-2:(c=d.lastIndex-u[2].length,e=u[1],d=void 0===u[3]?_:'"'===u[3]?p:m):d===p||d===m?d=_:d===a$1||d===f$1?d=v:(d=_,h=void 0);const y=d===_&&t[i+1].startsWith("/>")?" ":"";r+=d===v?s+l$4:c>=0?(n.push(e),s.slice(0,c)+"$lit$"+s.slice(c)+o$4+y):s+o$4+(-2===c?(n.push(void 0),i):y);}const u=r+(t[s]||"<?>")+(2===i?"</svg>":"");if(!Array.isArray(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return [void 0!==e$4?e$4.createHTML(u):u,n]};class C{constructor({strings:t,_$litType$:i},e){let l;this.parts=[];let h=0,d=0;const u=t.length-1,c=this.parts,[v,a]=E(t,i);if(this.el=C.createElement(v,e),A.currentNode=this.el.content,2===i){const t=this.el.content,i=t.firstChild;i.remove(),t.append(...i.childNodes);}for(;null!==(l=A.nextNode())&&c.length<u;){if(1===l.nodeType){if(l.hasAttributes()){const t=[];for(const i of l.getAttributeNames())if(i.endsWith("$lit$")||i.startsWith(o$4)){const s=a[d++];if(t.push(i),void 0!==s){const t=l.getAttribute(s.toLowerCase()+"$lit$").split(o$4),i=/([.?@])?(.*)/.exec(s);c.push({type:1,index:h,name:i[2],strings:t,ctor:"."===i[1]?M:"?"===i[1]?k:"@"===i[1]?H:S$1});}else c.push({type:6,index:h});}for(const i of t)l.removeAttribute(i);}if($.test(l.tagName)){const t=l.textContent.split(o$4),i=t.length-1;if(i>0){l.textContent=s$4?s$4.emptyScript:"";for(let s=0;s<i;s++)l.append(t[s],r$2()),A.nextNode(),c.push({type:2,index:++h});l.append(t[i],r$2());}}}else if(8===l.nodeType)if(l.data===n$3)c.push({type:2,index:h});else {let t=-1;for(;-1!==(t=l.data.indexOf(o$4,t+1));)c.push({type:7,index:h}),t+=o$4.length-1;}h++;}}static createElement(t,i){const s=h$1.createElement("template");return s.innerHTML=t,s}}function P(t,i,s=t,e){var o,n,l,h;if(i===x)return i;let r=void 0!==e?null===(o=s._$Co)||void 0===o?void 0:o[e]:s._$Cl;const u=d$1(i)?void 0:i._$litDirective$;return (null==r?void 0:r.constructor)!==u&&(null===(n=null==r?void 0:r._$AO)||void 0===n||n.call(r,!1),void 0===u?r=void 0:(r=new u(t),r._$AT(t,s,e)),void 0!==e?(null!==(l=(h=s)._$Co)&&void 0!==l?l:h._$Co=[])[e]=r:s._$Cl=r),void 0!==r&&(i=P(t,r._$AS(t,i.values),r,e)),i}class V{constructor(t,i){this.u=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}v(t){var i;const{el:{content:s},parts:e}=this._$AD,o=(null!==(i=null==t?void 0:t.creationScope)&&void 0!==i?i:h$1).importNode(s,!0);A.currentNode=o;let n=A.nextNode(),l=0,r=0,d=e[0];for(;void 0!==d;){if(l===d.index){let i;2===d.type?i=new N(n,n.nextSibling,this,t):1===d.type?i=new d.ctor(n,d.name,d.strings,this,t):6===d.type&&(i=new I(n,this,t)),this.u.push(i),d=e[++r];}l!==(null==d?void 0:d.index)&&(n=A.nextNode(),l++);}return o}p(t){let i=0;for(const s of this.u)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class N{constructor(t,i,s,e){var o;this.type=2,this._$AH=b,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cm=null===(o=null==e?void 0:e.isConnected)||void 0===o||o;}get _$AU(){var t,i;return null!==(i=null===(t=this._$AM)||void 0===t?void 0:t._$AU)&&void 0!==i?i:this._$Cm}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=P(this,t,i),d$1(t)?t===b||null==t||""===t?(this._$AH!==b&&this._$AR(),this._$AH=b):t!==this._$AH&&t!==x&&this.g(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):c$1(t)?this.k(t):this.g(t);}O(t,i=this._$AB){return this._$AA.parentNode.insertBefore(t,i)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t));}g(t){this._$AH!==b&&d$1(this._$AH)?this._$AA.nextSibling.data=t:this.T(h$1.createTextNode(t)),this._$AH=t;}$(t){var i;const{values:s,_$litType$:e}=t,o="number"==typeof e?this._$AC(t):(void 0===e.el&&(e.el=C.createElement(e.h,this.options)),e);if((null===(i=this._$AH)||void 0===i?void 0:i._$AD)===o)this._$AH.p(s);else {const t=new V(o,this),i=t.v(this.options);t.p(s),this.T(i),this._$AH=t;}}_$AC(t){let i=T.get(t.strings);return void 0===i&&T.set(t.strings,i=new C(t)),i}k(t){u(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const o of t)e===i.length?i.push(s=new N(this.O(r$2()),this.O(r$2()),this,this.options)):s=i[e],s._$AI(o),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,i){var s;for(null===(s=this._$AP)||void 0===s||s.call(this,!1,!0,i);t&&t!==this._$AB;){const i=t.nextSibling;t.remove(),t=i;}}setConnected(t){var i;void 0===this._$AM&&(this._$Cm=t,null===(i=this._$AP)||void 0===i||i.call(this,t));}}class S$1{constructor(t,i,s,e,o){this.type=1,this._$AH=b,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=o,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=b;}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}_$AI(t,i=this,s,e){const o=this.strings;let n=!1;if(void 0===o)t=P(this,t,i,0),n=!d$1(t)||t!==this._$AH&&t!==x,n&&(this._$AH=t);else {const e=t;let l,h;for(t=o[0],l=0;l<o.length-1;l++)h=P(this,e[s+l],i,l),h===x&&(h=this._$AH[l]),n||(n=!d$1(h)||h!==this._$AH[l]),h===b?t=b:t!==b&&(t+=(null!=h?h:"")+o[l+1]),this._$AH[l]=h;}n&&!e&&this.j(t);}j(t){t===b?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,null!=t?t:"");}}class M extends S$1{constructor(){super(...arguments),this.type=3;}j(t){this.element[this.name]=t===b?void 0:t;}}const R=s$4?s$4.emptyScript:"";class k extends S$1{constructor(){super(...arguments),this.type=4;}j(t){t&&t!==b?this.element.setAttribute(this.name,R):this.element.removeAttribute(this.name);}}class H extends S$1{constructor(t,i,s,e,o){super(t,i,s,e,o),this.type=5;}_$AI(t,i=this){var s;if((t=null!==(s=P(this,t,i,0))&&void 0!==s?s:b)===x)return;const e=this._$AH,o=t===b&&e!==b||t.capture!==e.capture||t.once!==e.once||t.passive!==e.passive,n=t!==b&&(e===b||o);o&&this.element.removeEventListener(this.name,this,e),n&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){var i,s;"function"==typeof this._$AH?this._$AH.call(null!==(s=null===(i=this.options)||void 0===i?void 0:i.host)&&void 0!==s?s:this.element,t):this._$AH.handleEvent(t);}}class I{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){P(this,t);}}const z=i$3.litHtmlPolyfillSupport;null==z||z(C,N),(null!==(t$2=i$3.litHtmlVersions)&&void 0!==t$2?t$2:i$3.litHtmlVersions=[]).push("2.4.0");const Z=(t,i,s)=>{var e,o;const n=null!==(e=null==s?void 0:s.renderBefore)&&void 0!==e?e:i;let l=n._$litPart$;if(void 0===l){const t=null!==(o=null==s?void 0:s.renderBefore)&&void 0!==o?o:null;n._$litPart$=l=new N(i.insertBefore(r$2(),t),t,void 0,null!=s?s:{});}return l._$AI(t),l};

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    const t$1=window,e$3=t$1.ShadowRoot&&(void 0===t$1.ShadyCSS||t$1.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s$3=Symbol(),n$2=new WeakMap;class o$3{constructor(t,e,n){if(this._$cssResult$=!0,n!==s$3)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e;}get styleSheet(){let t=this.o;const s=this.t;if(e$3&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=n$2.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&n$2.set(s,t));}return t}toString(){return this.cssText}}const r$1=t=>new o$3("string"==typeof t?t:t+"",void 0,s$3),i$2=(t,...e)=>{const n=1===t.length?t[0]:e.reduce(((e,s,n)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[n+1]),t[0]);return new o$3(n,t,s$3)},S=(s,n)=>{e$3?s.adoptedStyleSheets=n.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet)):n.forEach((e=>{const n=document.createElement("style"),o=t$1.litNonce;void 0!==o&&n.setAttribute("nonce",o),n.textContent=e.cssText,s.appendChild(n);}));},c=e$3?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return r$1(e)})(t):t;

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */var s$2;const e$2=window,r=e$2.trustedTypes,h=r?r.emptyScript:"",o$2=e$2.reactiveElementPolyfillSupport,n$1={toAttribute(t,i){switch(i){case Boolean:t=t?h:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,i){let s=t;switch(i){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t);}catch(t){s=null;}}return s}},a=(t,i)=>i!==t&&(i==i||t==t),l$3={attribute:!0,type:String,converter:n$1,reflect:!1,hasChanged:a};class d extends HTMLElement{constructor(){super(),this._$Ei=new Map,this.isUpdatePending=!1,this.hasUpdated=!1,this._$El=null,this.u();}static addInitializer(t){var i;null!==(i=this.h)&&void 0!==i||(this.h=[]),this.h.push(t);}static get observedAttributes(){this.finalize();const t=[];return this.elementProperties.forEach(((i,s)=>{const e=this._$Ep(s,i);void 0!==e&&(this._$Ev.set(e,s),t.push(e));})),t}static createProperty(t,i=l$3){if(i.state&&(i.attribute=!1),this.finalize(),this.elementProperties.set(t,i),!i.noAccessor&&!this.prototype.hasOwnProperty(t)){const s="symbol"==typeof t?Symbol():"__"+t,e=this.getPropertyDescriptor(t,s,i);void 0!==e&&Object.defineProperty(this.prototype,t,e);}}static getPropertyDescriptor(t,i,s){return {get(){return this[i]},set(e){const r=this[t];this[i]=e,this.requestUpdate(t,r,s);},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)||l$3}static finalize(){if(this.hasOwnProperty("finalized"))return !1;this.finalized=!0;const t=Object.getPrototypeOf(this);if(t.finalize(),this.elementProperties=new Map(t.elementProperties),this._$Ev=new Map,this.hasOwnProperty("properties")){const t=this.properties,i=[...Object.getOwnPropertyNames(t),...Object.getOwnPropertySymbols(t)];for(const s of i)this.createProperty(s,t[s]);}return this.elementStyles=this.finalizeStyles(this.styles),!0}static finalizeStyles(i){const s=[];if(Array.isArray(i)){const e=new Set(i.flat(1/0).reverse());for(const i of e)s.unshift(c(i));}else void 0!==i&&s.push(c(i));return s}static _$Ep(t,i){const s=i.attribute;return !1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}u(){var t;this._$E_=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$Eg(),this.requestUpdate(),null===(t=this.constructor.h)||void 0===t||t.forEach((t=>t(this)));}addController(t){var i,s;(null!==(i=this._$ES)&&void 0!==i?i:this._$ES=[]).push(t),void 0!==this.renderRoot&&this.isConnected&&(null===(s=t.hostConnected)||void 0===s||s.call(t));}removeController(t){var i;null===(i=this._$ES)||void 0===i||i.splice(this._$ES.indexOf(t)>>>0,1);}_$Eg(){this.constructor.elementProperties.forEach(((t,i)=>{this.hasOwnProperty(i)&&(this._$Ei.set(i,this[i]),delete this[i]);}));}createRenderRoot(){var t;const s=null!==(t=this.shadowRoot)&&void 0!==t?t:this.attachShadow(this.constructor.shadowRootOptions);return S(s,this.constructor.elementStyles),s}connectedCallback(){var t;void 0===this.renderRoot&&(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null===(t=this._$ES)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostConnected)||void 0===i?void 0:i.call(t)}));}enableUpdating(t){}disconnectedCallback(){var t;null===(t=this._$ES)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostDisconnected)||void 0===i?void 0:i.call(t)}));}attributeChangedCallback(t,i,s){this._$AK(t,s);}_$EO(t,i,s=l$3){var e;const r=this.constructor._$Ep(t,s);if(void 0!==r&&!0===s.reflect){const h=(void 0!==(null===(e=s.converter)||void 0===e?void 0:e.toAttribute)?s.converter:n$1).toAttribute(i,s.type);this._$El=t,null==h?this.removeAttribute(r):this.setAttribute(r,h),this._$El=null;}}_$AK(t,i){var s;const e=this.constructor,r=e._$Ev.get(t);if(void 0!==r&&this._$El!==r){const t=e.getPropertyOptions(r),h="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==(null===(s=t.converter)||void 0===s?void 0:s.fromAttribute)?t.converter:n$1;this._$El=r,this[r]=h.fromAttribute(i,t.type),this._$El=null;}}requestUpdate(t,i,s){let e=!0;void 0!==t&&(((s=s||this.constructor.getPropertyOptions(t)).hasChanged||a)(this[t],i)?(this._$AL.has(t)||this._$AL.set(t,i),!0===s.reflect&&this._$El!==t&&(void 0===this._$EC&&(this._$EC=new Map),this._$EC.set(t,s))):e=!1),!this.isUpdatePending&&e&&(this._$E_=this._$Ej());}async _$Ej(){this.isUpdatePending=!0;try{await this._$E_;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;this.hasUpdated,this._$Ei&&(this._$Ei.forEach(((t,i)=>this[i]=t)),this._$Ei=void 0);let i=!1;const s=this._$AL;try{i=this.shouldUpdate(s),i?(this.willUpdate(s),null===(t=this._$ES)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostUpdate)||void 0===i?void 0:i.call(t)})),this.update(s)):this._$Ek();}catch(t){throw i=!1,this._$Ek(),t}i&&this._$AE(s);}willUpdate(t){}_$AE(t){var i;null===(i=this._$ES)||void 0===i||i.forEach((t=>{var i;return null===(i=t.hostUpdated)||void 0===i?void 0:i.call(t)})),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t);}_$Ek(){this._$AL=new Map,this.isUpdatePending=!1;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$E_}shouldUpdate(t){return !0}update(t){void 0!==this._$EC&&(this._$EC.forEach(((t,i)=>this._$EO(i,this[i],t))),this._$EC=void 0),this._$Ek();}updated(t){}firstUpdated(t){}}d.finalized=!0,d.elementProperties=new Map,d.elementStyles=[],d.shadowRootOptions={mode:"open"},null==o$2||o$2({ReactiveElement:d}),(null!==(s$2=e$2.reactiveElementVersions)&&void 0!==s$2?s$2:e$2.reactiveElementVersions=[]).push("1.4.1");

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */var l$2,o$1;class s$1 extends d{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0;}createRenderRoot(){var t,e;const i=super.createRenderRoot();return null!==(t=(e=this.renderOptions).renderBefore)&&void 0!==t||(e.renderBefore=i.firstChild),i}update(t){const i=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Z(i,this.renderRoot,this.renderOptions);}connectedCallback(){var t;super.connectedCallback(),null===(t=this._$Do)||void 0===t||t.setConnected(!0);}disconnectedCallback(){var t;super.disconnectedCallback(),null===(t=this._$Do)||void 0===t||t.setConnected(!1);}render(){return x}}s$1.finalized=!0,s$1._$litElement$=!0,null===(l$2=globalThis.litElementHydrateSupport)||void 0===l$2||l$2.call(globalThis,{LitElement:s$1});const n=globalThis.litElementPolyfillSupport;null==n||n({LitElement:s$1});(null!==(o$1=globalThis.litElementVersions)&&void 0!==o$1?o$1:globalThis.litElementVersions=[]).push("3.2.2");

    /**
     * @license
     * Copyright 2017 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */
    const t={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},e$1=t=>(...e)=>({_$litDirective$:t,values:e});class i$1{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i;}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}}

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */const o=e$1(class extends i$1{constructor(t$1){var i;if(super(t$1),t$1.type!==t.ATTRIBUTE||"class"!==t$1.name||(null===(i=t$1.strings)||void 0===i?void 0:i.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return " "+Object.keys(t).filter((i=>t[i])).join(" ")+" "}update(i,[s]){var r,o;if(void 0===this.nt){this.nt=new Set,void 0!==i.strings&&(this.st=new Set(i.strings.join(" ").split(/\s/).filter((t=>""!==t))));for(const t in s)s[t]&&!(null===(r=this.st)||void 0===r?void 0:r.has(t))&&this.nt.add(t);return this.render(s)}const e=i.element.classList;this.nt.forEach((t=>{t in s||(e.remove(t),this.nt.delete(t));}));for(const t in s){const i=!!s[t];i===this.nt.has(t)||(null===(o=this.st)||void 0===o?void 0:o.has(t))||(i?(e.add(t),this.nt.add(t)):(e.remove(t),this.nt.delete(t)));}return x}});

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */const l$1=l=>null!=l?l:b;

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */const i=e$1(class extends i$1{constructor(t$1){var e;if(super(t$1),t$1.type!==t.ATTRIBUTE||"style"!==t$1.name||(null===(e=t$1.strings)||void 0===e?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce(((e,r)=>{const s=t[r];return null==s?e:e+`${r=r.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${s};`}),"")}update(e,[r]){const{style:s}=e.element;if(void 0===this.vt){this.vt=new Set;for(const t in r)this.vt.add(t);return this.render(r)}this.vt.forEach((t=>{null==r[t]&&(this.vt.delete(t),t.includes("-")?s.removeProperty(t):s[t]="");}));for(const t in r){const e=r[t];null!=e&&(this.vt.add(t),t.includes("-")?s.setProperty(t,e):s[t]=e);}return x}});

    /**
     * @license
     * Copyright 2020 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    class CircularProgressBase extends s$1 {
        constructor() {
            super(...arguments);
            this.indeterminate = false;
            this.progress = 0;
            this.density = 0;
            this.closed = false;
        }
        open() {
            this.closed = false;
        }
        close() {
            this.closed = true;
        }
        /**
         * @soyTemplate
         */
        render() {
            /** @classMap */
            const classes = {
                'mdc-circular-progress--closed': this.closed,
                'mdc-circular-progress--indeterminate': this.indeterminate,
            };
            const containerSideLength = 48 + this.density * 4;
            /** @styleMap */
            const styles = {
                'width': `${containerSideLength}px`,
                'height': `${containerSideLength}px`,
            };
            return y `
      <div
        class="mdc-circular-progress ${o(classes)}"
        style="${i(styles)}"
        role="progressbar"
        aria-label="${l$1(this.ariaLabel)}"
        aria-valuemin="0"
        aria-valuemax="1"
        aria-valuenow="${l$1(this.indeterminate ? undefined : this.progress)}">
        ${this.renderDeterminateContainer()}
        ${this.renderIndeterminateContainer()}
      </div>`;
        }
        /**
         * @soyTemplate
         */
        renderDeterminateContainer() {
            const sideLength = 48 + this.density * 4;
            const center = sideLength / 2;
            const circleRadius = this.density >= -3 ? 18 + this.density * 11 / 6 :
                12.5 + (this.density + 3) * 5 / 4;
            const circumference = 2 * 3.1415926 * circleRadius;
            const determinateStrokeDashOffset = (1 - this.progress) * circumference;
            const strokeWidth = this.density >= -3 ? 4 + this.density * (1 / 3) :
                3 + (this.density + 3) * (1 / 6);
            return y `
      <div class="mdc-circular-progress__determinate-container">
        <svg class="mdc-circular-progress__determinate-circle-graphic"
             viewBox="0 0 ${sideLength} ${sideLength}">
          <circle class="mdc-circular-progress__determinate-track"
                  cx="${center}" cy="${center}" r="${circleRadius}"
                  stroke-width="${strokeWidth}"></circle>
          <circle class="mdc-circular-progress__determinate-circle"
                  cx="${center}" cy="${center}" r="${circleRadius}"
                  stroke-dasharray="${2 * 3.1415926 * circleRadius}"
                  stroke-dashoffset="${determinateStrokeDashOffset}"
                  stroke-width="${strokeWidth}"></circle>
        </svg>
      </div>`;
        }
        /**
         * @soyTemplate
         */
        renderIndeterminateContainer() {
            return y `
      <div class="mdc-circular-progress__indeterminate-container">
        <div class="mdc-circular-progress__spinner-layer">
          ${this.renderIndeterminateSpinnerLayer()}
        </div>
      </div>`;
        }
        /**
         * @soyTemplate
         */
        renderIndeterminateSpinnerLayer() {
            const sideLength = 48 + this.density * 4;
            const center = sideLength / 2;
            const circleRadius = this.density >= -3 ? 18 + this.density * 11 / 6 :
                12.5 + (this.density + 3) * 5 / 4;
            const circumference = 2 * 3.1415926 * circleRadius;
            const halfCircumference = 0.5 * circumference;
            const strokeWidth = this.density >= -3 ? 4 + this.density * (1 / 3) :
                3 + (this.density + 3) * (1 / 6);
            return y `
        <div class="mdc-circular-progress__circle-clipper mdc-circular-progress__circle-left">
          <svg class="mdc-circular-progress__indeterminate-circle-graphic"
               viewBox="0 0 ${sideLength} ${sideLength}">
            <circle cx="${center}" cy="${center}" r="${circleRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${halfCircumference}"
                    stroke-width="${strokeWidth}"></circle>
          </svg>
        </div>
        <div class="mdc-circular-progress__gap-patch">
          <svg class="mdc-circular-progress__indeterminate-circle-graphic"
               viewBox="0 0 ${sideLength} ${sideLength}">
            <circle cx="${center}" cy="${center}" r="${circleRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${halfCircumference}"
                    stroke-width="${strokeWidth * 0.8}"></circle>
          </svg>
        </div>
        <div class="mdc-circular-progress__circle-clipper mdc-circular-progress__circle-right">
          <svg class="mdc-circular-progress__indeterminate-circle-graphic"
               viewBox="0 0 ${sideLength} ${sideLength}">
            <circle cx="${center}" cy="${center}" r="${circleRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${halfCircumference}"
                    stroke-width="${strokeWidth}"></circle>
          </svg>
        </div>`;
        }
        update(changedProperties) {
            super.update(changedProperties);
            // Bound progress value in interval [0, 1].
            if (changedProperties.has('progress')) {
                if (this.progress > 1) {
                    this.progress = 1;
                }
                if (this.progress < 0) {
                    this.progress = 0;
                }
            }
        }
    }
    __decorate$7([
        e$9({ type: Boolean, reflect: true })
    ], CircularProgressBase.prototype, "indeterminate", void 0);
    __decorate$7([
        e$9({ type: Number, reflect: true })
    ], CircularProgressBase.prototype, "progress", void 0);
    __decorate$7([
        e$9({ type: Number, reflect: true })
    ], CircularProgressBase.prototype, "density", void 0);
    __decorate$7([
        e$9({ type: Boolean, reflect: true })
    ], CircularProgressBase.prototype, "closed", void 0);
    __decorate$7([
        ariaProperty,
        e$9({ type: String, attribute: 'aria-label' })
    ], CircularProgressBase.prototype, "ariaLabel", void 0);

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles$6 = i$2 `.mdc-circular-progress__determinate-circle,.mdc-circular-progress__indeterminate-circle-graphic{stroke:#6200ee;stroke:var(--mdc-theme-primary, #6200ee)}.mdc-circular-progress__determinate-track{stroke:transparent}@keyframes mdc-circular-progress-container-rotate{to{transform:rotate(360deg)}}@keyframes mdc-circular-progress-spinner-layer-rotate{12.5%{transform:rotate(135deg)}25%{transform:rotate(270deg)}37.5%{transform:rotate(405deg)}50%{transform:rotate(540deg)}62.5%{transform:rotate(675deg)}75%{transform:rotate(810deg)}87.5%{transform:rotate(945deg)}100%{transform:rotate(1080deg)}}@keyframes mdc-circular-progress-color-1-fade-in-out{from{opacity:.99}25%{opacity:.99}26%{opacity:0}89%{opacity:0}90%{opacity:.99}to{opacity:.99}}@keyframes mdc-circular-progress-color-2-fade-in-out{from{opacity:0}15%{opacity:0}25%{opacity:.99}50%{opacity:.99}51%{opacity:0}to{opacity:0}}@keyframes mdc-circular-progress-color-3-fade-in-out{from{opacity:0}40%{opacity:0}50%{opacity:.99}75%{opacity:.99}76%{opacity:0}to{opacity:0}}@keyframes mdc-circular-progress-color-4-fade-in-out{from{opacity:0}65%{opacity:0}75%{opacity:.99}90%{opacity:.99}to{opacity:0}}@keyframes mdc-circular-progress-left-spin{from{transform:rotate(265deg)}50%{transform:rotate(130deg)}to{transform:rotate(265deg)}}@keyframes mdc-circular-progress-right-spin{from{transform:rotate(-265deg)}50%{transform:rotate(-130deg)}to{transform:rotate(-265deg)}}.mdc-circular-progress{display:inline-flex;position:relative;direction:ltr;line-height:0;transition:opacity 250ms 0ms cubic-bezier(0.4, 0, 0.6, 1)}.mdc-circular-progress__determinate-container,.mdc-circular-progress__indeterminate-circle-graphic,.mdc-circular-progress__indeterminate-container,.mdc-circular-progress__spinner-layer{position:absolute;width:100%;height:100%}.mdc-circular-progress__determinate-container{transform:rotate(-90deg)}.mdc-circular-progress__indeterminate-container{font-size:0;letter-spacing:0;white-space:nowrap;opacity:0}.mdc-circular-progress__determinate-circle-graphic,.mdc-circular-progress__indeterminate-circle-graphic{fill:transparent}.mdc-circular-progress__determinate-circle{transition:stroke-dashoffset 500ms 0ms cubic-bezier(0, 0, 0.2, 1)}.mdc-circular-progress__gap-patch{position:absolute;top:0;left:47.5%;box-sizing:border-box;width:5%;height:100%;overflow:hidden}.mdc-circular-progress__gap-patch .mdc-circular-progress__indeterminate-circle-graphic{left:-900%;width:2000%;transform:rotate(180deg)}.mdc-circular-progress__circle-clipper{display:inline-flex;position:relative;width:50%;height:100%;overflow:hidden}.mdc-circular-progress__circle-clipper .mdc-circular-progress__indeterminate-circle-graphic{width:200%}.mdc-circular-progress__circle-right .mdc-circular-progress__indeterminate-circle-graphic{left:-100%}.mdc-circular-progress--indeterminate .mdc-circular-progress__determinate-container{opacity:0}.mdc-circular-progress--indeterminate .mdc-circular-progress__indeterminate-container{opacity:1}.mdc-circular-progress--indeterminate .mdc-circular-progress__indeterminate-container{animation:mdc-circular-progress-container-rotate 1568.2352941176ms linear infinite}.mdc-circular-progress--indeterminate .mdc-circular-progress__spinner-layer{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-1{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-1-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-2{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-2-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-3{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-3-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__color-4{animation:mdc-circular-progress-spinner-layer-rotate 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both,mdc-circular-progress-color-4-fade-in-out 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__circle-left .mdc-circular-progress__indeterminate-circle-graphic{animation:mdc-circular-progress-left-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--indeterminate .mdc-circular-progress__circle-right .mdc-circular-progress__indeterminate-circle-graphic{animation:mdc-circular-progress-right-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both}.mdc-circular-progress--closed{opacity:0}:host{display:inline-flex}.mdc-circular-progress__determinate-track{stroke:transparent;stroke:var(--mdc-circular-progress-track-color, transparent)}`;

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    let CircularProgress = class CircularProgress extends CircularProgressBase {
    };
    CircularProgress.styles = [styles$6];
    CircularProgress = __decorate$7([
        e$a('mwc-circular-progress')
    ], CircularProgress);

    /*
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     */

    const isUndefined = value => typeof value === "undefined";

    const isFunction = value => typeof value === "function";

    const isNumber = value => typeof value === "number";

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
    	return (
    		!event.defaultPrevented &&
    		event.button === 0 &&
    		!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    	);
    }

    function createCounter() {
    	let i = 0;
    	/**
    	 * Returns an id and increments the internal state
    	 * @returns {number}
    	 */
    	return () => i++;
    }

    /**
     * Create a globally unique id
     *
     * @returns {string} An id
     */
    function createGlobalId() {
    	return Math.random().toString(36).substring(2);
    }

    const isSSR = typeof window === "undefined";

    function addListener(target, type, handler) {
    	target.addEventListener(type, handler);
    	return () => target.removeEventListener(type, handler);
    }

    const createInlineStyle = (disableInlineStyles, style) =>
    	disableInlineStyles ? {} : { style };
    const createMarkerProps = disableInlineStyles => ({
    	"aria-hidden": "true",
    	...createInlineStyle(disableInlineStyles, "display:none;"),
    });

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    /*
     * Adapted from https://github.com/EmilTholin/svelte-routing
     *
     * https://github.com/EmilTholin/svelte-routing/blob/master/LICENSE
     */

    const createKey = ctxName => `@@svnav-ctx__${ctxName}`;

    // Use strings instead of objects, so different versions of
    // svelte-navigator can potentially still work together
    const LOCATION = createKey("LOCATION");
    const ROUTER = createKey("ROUTER");
    const ROUTE = createKey("ROUTE");
    const ROUTE_PARAMS = createKey("ROUTE_PARAMS");
    const FOCUS_ELEM = createKey("FOCUS_ELEM");

    const paramRegex = /^:(.+)/;

    const substr = (str, start, end) => str.substr(start, end);

    /**
     * Check if `string` starts with `search`
     * @param {string} string
     * @param {string} search
     * @return {boolean}
     */
    const startsWith = (string, search) =>
    	substr(string, 0, search.length) === search;

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    const isRootSegment = segment => segment === "";

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    const isDynamic = segment => paramRegex.test(segment);

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    const isSplat = segment => segment[0] === "*";

    /**
     * Strip potention splat and splatname of the end of a path
     * @param {string} str
     * @return {string}
     */
    const stripSplat = str => str.replace(/\*.*$/, "");

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    const stripSlashes = str => str.replace(/(^\/+|\/+$)/g, "");

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri, filterFalsy = false) {
    	const segments = stripSlashes(uri).split("/");
    	return filterFalsy ? segments.filter(Boolean) : segments;
    }

    /**
     * Add the query to the pathname if a query is given
     * @param {string} pathname
     * @param {string} [query]
     * @return {string}
     */
    const addQuery = (pathname, query) =>
    	pathname + (query ? `?${query}` : "");

    /**
     * Normalizes a basepath
     *
     * @param {string} path
     * @returns {string}
     *
     * @example
     * normalizePath("base/path/") // -> "/base/path"
     */
    const normalizePath = path => `/${stripSlashes(path)}`;

    /**
     * Joins and normalizes multiple path fragments
     *
     * @param {...string} pathFragments
     * @returns {string}
     */
    function join(...pathFragments) {
    	const joinFragment = fragment => segmentize(fragment, true).join("/");
    	const joinedSegments = pathFragments.map(joinFragment).join("/");
    	return normalizePath(joinedSegments);
    }

    // We start from 1 here, so we can check if an origin id has been passed
    // by using `originId || <fallback>`
    const LINK_ID = 1;
    const ROUTE_ID = 2;
    const ROUTER_ID = 3;
    const USE_FOCUS_ID = 4;
    const USE_LOCATION_ID = 5;
    const USE_MATCH_ID = 6;
    const USE_NAVIGATE_ID = 7;
    const USE_PARAMS_ID = 8;
    const USE_RESOLVABLE_ID = 9;
    const USE_RESOLVE_ID = 10;
    const NAVIGATE_ID = 11;

    const labels = {
    	[LINK_ID]: "Link",
    	[ROUTE_ID]: "Route",
    	[ROUTER_ID]: "Router",
    	[USE_FOCUS_ID]: "useFocus",
    	[USE_LOCATION_ID]: "useLocation",
    	[USE_MATCH_ID]: "useMatch",
    	[USE_NAVIGATE_ID]: "useNavigate",
    	[USE_PARAMS_ID]: "useParams",
    	[USE_RESOLVABLE_ID]: "useResolvable",
    	[USE_RESOLVE_ID]: "useResolve",
    	[NAVIGATE_ID]: "navigate",
    };

    const createLabel = labelId => labels[labelId];

    function createIdentifier(labelId, props) {
    	let attr;
    	if (labelId === ROUTE_ID) {
    		attr = props.path ? `path="${props.path}"` : "default";
    	} else if (labelId === LINK_ID) {
    		attr = `to="${props.to}"`;
    	} else if (labelId === ROUTER_ID) {
    		attr = `basepath="${props.basepath || ""}"`;
    	}
    	return `<${createLabel(labelId)} ${attr || ""} />`;
    }

    function createMessage(labelId, message, props, originId) {
    	const origin = props && createIdentifier(originId || labelId, props);
    	const originMsg = origin ? `\n\nOccurred in: ${origin}` : "";
    	const label = createLabel(labelId);
    	const msg = isFunction(message) ? message(label) : message;
    	return `<${label}> ${msg}${originMsg}`;
    }

    const createMessageHandler =
    	handler =>
    	(...args) =>
    		handler(createMessage(...args));

    const fail = createMessageHandler(message => {
    	throw new Error(message);
    });

    // eslint-disable-next-line no-console
    const warn = createMessageHandler(console.warn);

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
    	const score = route.default
    		? 0
    		: segmentize(route.fullPath).reduce((acc, segment) => {
    				let nextScore = acc;
    				nextScore += SEGMENT_POINTS;

    				if (isRootSegment(segment)) {
    					nextScore += ROOT_POINTS;
    				} else if (isDynamic(segment)) {
    					nextScore += DYNAMIC_POINTS;
    				} else if (isSplat(segment)) {
    					nextScore -= SEGMENT_POINTS + SPLAT_PENALTY;
    				} else {
    					nextScore += STATIC_POINTS;
    				}

    				return nextScore;
    		  }, 0);

    	return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
    	return (
    		routes
    			.map(rankRoute)
    			// If two routes have the exact same score, we go by index instead
    			.sort((a, b) => {
    				if (a.score < b.score) {
    					return 1;
    				}
    				if (a.score > b.score) {
    					return -1;
    				}
    				return a.index - b.index;
    			})
    	);
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { fullPath, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
    	let bestMatch;
    	let defaultMatch;

    	const [uriPathname] = uri.split("?");
    	const uriSegments = segmentize(uriPathname);
    	const isRootUri = uriSegments[0] === "";
    	const ranked = rankRoutes(routes);

    	for (let i = 0, l = ranked.length; i < l; i++) {
    		const { route } = ranked[i];
    		let missed = false;
    		const params = {};

    		// eslint-disable-next-line no-shadow
    		const createMatch = uri => ({ ...route, params, uri });

    		if (route.default) {
    			defaultMatch = createMatch(uri);
    			continue;
    		}

    		const routeSegments = segmentize(route.fullPath);
    		const max = Math.max(uriSegments.length, routeSegments.length);
    		let index = 0;

    		for (; index < max; index++) {
    			const routeSegment = routeSegments[index];
    			const uriSegment = uriSegments[index];

    			if (!isUndefined(routeSegment) && isSplat(routeSegment)) {
    				// Hit a splat, just grab the rest, and return a match
    				// uri:   /files/documents/work
    				// route: /files/* or /files/*splatname
    				const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

    				params[splatName] = uriSegments
    					.slice(index)
    					.map(decodeURIComponent)
    					.join("/");
    				break;
    			}

    			if (isUndefined(uriSegment)) {
    				// URI is shorter than the route, no match
    				// uri:   /users
    				// route: /users/:userId
    				missed = true;
    				break;
    			}

    			const dynamicMatch = paramRegex.exec(routeSegment);

    			if (dynamicMatch && !isRootUri) {
    				const value = decodeURIComponent(uriSegment);
    				params[dynamicMatch[1]] = value;
    			} else if (routeSegment !== uriSegment) {
    				// Current segments don't match, not dynamic, not splat, so no match
    				// uri:   /users/123/settings
    				// route: /users/:id/profile
    				missed = true;
    				break;
    			}
    		}

    		if (!missed) {
    			bestMatch = createMatch(join(...uriSegments.slice(0, index)));
    			break;
    		}
    	}

    	return bestMatch || defaultMatch || null;
    }

    /**
     * Check if the `route.fullPath` matches the `uri`.
     * @param {Object} route
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
    	return pick([route], uri);
    }

    /**
     * Resolve URIs as though every path is a directory, no files. Relative URIs
     * in the browser can feel awkward because not only can you be "in a directory",
     * you can be "at a file", too. For example:
     *
     *  browserSpecResolve('foo', '/bar/') => /bar/foo
     *  browserSpecResolve('foo', '/bar') => /foo
     *
     * But on the command line of a file system, it's not as complicated. You can't
     * `cd` from a file, only directories. This way, links have to know less about
     * their current path. To go deeper you can do this:
     *
     *  <Link to="deeper"/>
     *  // instead of
     *  <Link to=`{${props.uri}/deeper}`/>
     *
     * Just like `cd`, if you want to go deeper from the command line, you do this:
     *
     *  cd deeper
     *  # not
     *  cd $(pwd)/deeper
     *
     * By treating every path as a directory, linking to relative paths should
     * require less contextual information and (fingers crossed) be more intuitive.
     * @param {string} to
     * @param {string} base
     * @return {string}
     */
    function resolve(to, base) {
    	// /foo/bar, /baz/qux => /foo/bar
    	if (startsWith(to, "/")) {
    		return to;
    	}

    	const [toPathname, toQuery] = to.split("?");
    	const [basePathname] = base.split("?");
    	const toSegments = segmentize(toPathname);
    	const baseSegments = segmentize(basePathname);

    	// ?a=b, /users?b=c => /users?a=b
    	if (toSegments[0] === "") {
    		return addQuery(basePathname, toQuery);
    	}

    	// profile, /users/789 => /users/789/profile
    	if (!startsWith(toSegments[0], ".")) {
    		const pathname = baseSegments.concat(toSegments).join("/");
    		return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
    	}

    	// ./       , /users/123 => /users/123
    	// ../      , /users/123 => /users
    	// ../..    , /users/123 => /
    	// ../../one, /a/b/c/d   => /a/b/one
    	// .././one , /a/b/c/d   => /a/b/c/one
    	const allSegments = baseSegments.concat(toSegments);
    	const segments = [];

    	allSegments.forEach(segment => {
    		if (segment === "..") {
    			segments.pop();
    		} else if (segment !== ".") {
    			segments.push(segment);
    		}
    	});

    	return addQuery(`/${segments.join("/")}`, toQuery);
    }

    /**
     * Normalizes a location for consumption by `Route` children and the `Router`.
     * It removes the apps basepath from the pathname
     * and sets default values for `search` and `hash` properties.
     *
     * @param {Object} location The current global location supplied by the history component
     * @param {string} basepath The applications basepath (i.e. when serving from a subdirectory)
     *
     * @returns The normalized location
     */
    function normalizeLocation(location, basepath) {
    	const { pathname, hash = "", search = "", state } = location;
    	const baseSegments = segmentize(basepath, true);
    	const pathSegments = segmentize(pathname, true);
    	while (baseSegments.length) {
    		if (baseSegments[0] !== pathSegments[0]) {
    			fail(
    				ROUTER_ID,
    				`Invalid state: All locations must begin with the basepath "${basepath}", found "${pathname}"`,
    			);
    		}
    		baseSegments.shift();
    		pathSegments.shift();
    	}
    	return {
    		pathname: join(...pathSegments),
    		hash,
    		search,
    		state,
    	};
    }

    const normalizeUrlFragment = frag => (frag.length === 1 ? "" : frag);

    /**
     * Creates a location object from an url.
     * It is used to create a location from the url prop used in SSR
     *
     * @param {string} url The url string (e.g. "/path/to/somewhere")
     * @returns {{ pathname: string; search: string; hash: string }} The location
     *
     * @example
     * ```js
     * const path = "/search?q=falafel#result-3";
     * const location = parsePath(path);
     * // -> {
     * //   pathname: "/search",
     * //   search: "?q=falafel",
     * //   hash: "#result-3",
     * // };
     * ```
     */
    const parsePath = path => {
    	const searchIndex = path.indexOf("?");
    	const hashIndex = path.indexOf("#");
    	const hasSearchIndex = searchIndex !== -1;
    	const hasHashIndex = hashIndex !== -1;
    	const hash = hasHashIndex
    		? normalizeUrlFragment(substr(path, hashIndex))
    		: "";
    	const pathnameAndSearch = hasHashIndex ? substr(path, 0, hashIndex) : path;
    	const search = hasSearchIndex
    		? normalizeUrlFragment(substr(pathnameAndSearch, searchIndex))
    		: "";
    	const pathname =
    		(hasSearchIndex
    			? substr(pathnameAndSearch, 0, searchIndex)
    			: pathnameAndSearch) || "/";
    	return { pathname, search, hash };
    };

    /**
     * Joins a location object to one path string.
     *
     * @param {{ pathname: string; search: string; hash: string }} location The location object
     * @returns {string} A path, created from the location
     *
     * @example
     * ```js
     * const location = {
     *   pathname: "/search",
     *   search: "?q=falafel",
     *   hash: "#result-3",
     * };
     * const path = stringifyPath(location);
     * // -> "/search?q=falafel#result-3"
     * ```
     */
    const stringifyPath = location => {
    	const { pathname, search, hash } = location;
    	return pathname + search + hash;
    };

    /**
     * Resolves a link relative to the parent Route and the Routers basepath.
     *
     * @param {string} path The given path, that will be resolved
     * @param {string} routeBase The current Routes base path
     * @param {string} appBase The basepath of the app. Used, when serving from a subdirectory
     * @returns {string} The resolved path
     *
     * @example
     * resolveLink("relative", "/routeBase", "/") // -> "/routeBase/relative"
     * resolveLink("/absolute", "/routeBase", "/") // -> "/absolute"
     * resolveLink("relative", "/routeBase", "/base") // -> "/base/routeBase/relative"
     * resolveLink("/absolute", "/routeBase", "/base") // -> "/base/absolute"
     */
    function resolveLink(path, routeBase, appBase) {
    	return join(appBase, resolve(path, routeBase));
    }

    /**
     * Get the uri for a Route, by matching it against the current location.
     *
     * @param {string} routePath The Routes resolved path
     * @param {string} pathname The current locations pathname
     */
    function extractBaseUri(routePath, pathname) {
    	const fullPath = normalizePath(stripSplat(routePath));
    	const baseSegments = segmentize(fullPath, true);
    	const pathSegments = segmentize(pathname, true).slice(0, baseSegments.length);
    	const routeMatch = match({ fullPath }, join(...pathSegments));
    	return routeMatch && routeMatch.uri;
    }

    /*
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     */

    const POP = "POP";
    const PUSH = "PUSH";
    const REPLACE = "REPLACE";

    function getLocation(source) {
    	return {
    		...source.location,
    		pathname: encodeURI(decodeURI(source.location.pathname)),
    		state: source.history.state,
    		_key: (source.history.state && source.history.state._key) || "initial",
    	};
    }

    function createHistory(source) {
    	let listeners = [];
    	let location = getLocation(source);
    	let action = POP;

    	const notifyListeners = (listenerFns = listeners) =>
    		listenerFns.forEach(listener => listener({ location, action }));

    	return {
    		get location() {
    			return location;
    		},
    		listen(listener) {
    			listeners.push(listener);

    			const popstateListener = () => {
    				location = getLocation(source);
    				action = POP;
    				notifyListeners([listener]);
    			};

    			// Call listener when it is registered
    			notifyListeners([listener]);

    			const unlisten = addListener(source, "popstate", popstateListener);
    			return () => {
    				unlisten();
    				listeners = listeners.filter(fn => fn !== listener);
    			};
    		},
    		/**
    		 * Navigate to a new absolute route.
    		 *
    		 * @param {string|number} to The path to navigate to.
    		 *
    		 * If `to` is a number we will navigate to the stack entry index + `to`
    		 * (-> `navigate(-1)`, is equivalent to hitting the back button of the browser)
    		 * @param {Object} options
    		 * @param {*} [options.state] The state will be accessible through `location.state`
    		 * @param {boolean} [options.replace=false] Replace the current entry in the history
    		 * stack, instead of pushing on a new one
    		 */
    		navigate(to, options) {
    			const { state = {}, replace = false } = options || {};
    			action = replace ? REPLACE : PUSH;
    			if (isNumber(to)) {
    				if (options) {
    					warn(
    						NAVIGATE_ID,
    						"Navigation options (state or replace) are not supported, " +
    							"when passing a number as the first argument to navigate. " +
    							"They are ignored.",
    					);
    				}
    				action = POP;
    				source.history.go(to);
    			} else {
    				const keyedState = { ...state, _key: createGlobalId() };
    				// try...catch iOS Safari limits to 100 pushState calls
    				try {
    					source.history[replace ? "replaceState" : "pushState"](
    						keyedState,
    						"",
    						to,
    					);
    				} catch (e) {
    					source.location[replace ? "replace" : "assign"](to);
    				}
    			}

    			location = getLocation(source);
    			notifyListeners();
    		},
    	};
    }

    function createStackFrame(state, uri) {
    	return { ...parsePath(uri), state };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
    	let index = 0;
    	let stack = [createStackFrame(null, initialPathname)];

    	return {
    		// This is just for testing...
    		get entries() {
    			return stack;
    		},
    		get location() {
    			return stack[index];
    		},
    		addEventListener() {},
    		removeEventListener() {},
    		history: {
    			get state() {
    				return stack[index].state;
    			},
    			pushState(state, title, uri) {
    				index++;
    				// Throw away anything in the stack with an index greater than the current index.
    				// This happens, when we go back using `go(-n)`. The index is now less than `stack.length`.
    				// If we call `go(+n)` the stack entries with an index greater than the current index can
    				// be reused.
    				// However, if we navigate to a path, instead of a number, we want to create a new branch
    				// of navigation.
    				stack = stack.slice(0, index);
    				stack.push(createStackFrame(state, uri));
    			},
    			replaceState(state, title, uri) {
    				stack[index] = createStackFrame(state, uri);
    			},
    			go(to) {
    				const newIndex = index + to;
    				if (newIndex < 0 || newIndex > stack.length - 1) {
    					return;
    				}
    				index = newIndex;
    			},
    		},
    	};
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = !!(
    	!isSSR &&
    	window.document &&
    	window.document.createElement
    );
    // Use memory history in iframes (for example in Svelte REPL)
    const isEmbeddedPage = !isSSR && window.location.origin === "null";
    const globalHistory = createHistory(
    	canUseDOM && !isEmbeddedPage ? window : createMemorySource(),
    );

    // We need to keep the focus candidate in a separate file, so svelte does
    // not update, when we mutate it.
    // Also, we need a single global reference, because taking focus needs to
    // work globally, even if we have multiple top level routers
    // eslint-disable-next-line import/no-mutable-exports
    let focusCandidate = null;

    // eslint-disable-next-line import/no-mutable-exports
    let initialNavigation = true;

    /**
     * Check if RouterA is above RouterB in the document
     * @param {number} routerIdA The first Routers id
     * @param {number} routerIdB The second Routers id
     */
    function isAbove(routerIdA, routerIdB) {
    	const routerMarkers = document.querySelectorAll("[data-svnav-router]");
    	for (let i = 0; i < routerMarkers.length; i++) {
    		const node = routerMarkers[i];
    		const currentId = Number(node.dataset.svnavRouter);
    		if (currentId === routerIdA) return true;
    		if (currentId === routerIdB) return false;
    	}
    	return false;
    }

    /**
     * Check if a Route candidate is the best choice to move focus to,
     * and store the best match.
     * @param {{
         level: number;
         routerId: number;
         route: {
           id: number;
           focusElement: import("svelte/store").Readable<Promise<Element>|null>;
         }
       }} item A Route candidate, that updated and is visible after a navigation
     */
    function pushFocusCandidate(item) {
    	if (
    		// Best candidate if it's the only candidate...
    		!focusCandidate ||
    		// Route is nested deeper, than previous candidate
    		// -> Route change was triggered in the deepest affected
    		// Route, so that's were focus should move to
    		item.level > focusCandidate.level ||
    		// If the level is identical, we want to focus the first Route in the document,
    		// so we pick the first Router lookin from page top to page bottom.
    		(item.level === focusCandidate.level &&
    			isAbove(item.routerId, focusCandidate.routerId))
    	) {
    		focusCandidate = item;
    	}
    }

    /**
     * Reset the focus candidate.
     */
    function clearFocusCandidate() {
    	focusCandidate = null;
    }

    function initialNavigationOccurred() {
    	initialNavigation = false;
    }

    /*
     * `focus` Adapted from https://github.com/oaf-project/oaf-side-effects/blob/master/src/index.ts
     *
     * https://github.com/oaf-project/oaf-side-effects/blob/master/LICENSE
     */
    function focus(elem) {
    	if (!elem) return false;
    	const TABINDEX = "tabindex";
    	try {
    		if (!elem.hasAttribute(TABINDEX)) {
    			elem.setAttribute(TABINDEX, "-1");
    			let unlisten;
    			// We remove tabindex after blur to avoid weird browser behavior
    			// where a mouse click can activate elements with tabindex="-1".
    			const blurListener = () => {
    				elem.removeAttribute(TABINDEX);
    				unlisten();
    			};
    			unlisten = addListener(elem, "blur", blurListener);
    		}
    		elem.focus();
    		return document.activeElement === elem;
    	} catch (e) {
    		// Apparently trying to focus a disabled element in IE can throw.
    		// See https://stackoverflow.com/a/1600194/2476884
    		return false;
    	}
    }

    function isEndMarker(elem, id) {
    	return Number(elem.dataset.svnavRouteEnd) === id;
    }

    function isHeading(elem) {
    	return /^H[1-6]$/i.test(elem.tagName);
    }

    function query(selector, parent = document) {
    	return parent.querySelector(selector);
    }

    function queryHeading(id) {
    	const marker = query(`[data-svnav-route-start="${id}"]`);
    	let current = marker.nextElementSibling;
    	while (!isEndMarker(current, id)) {
    		if (isHeading(current)) {
    			return current;
    		}
    		const heading = query("h1,h2,h3,h4,h5,h6", current);
    		if (heading) {
    			return heading;
    		}
    		current = current.nextElementSibling;
    	}
    	return null;
    }

    function handleFocus(route) {
    	Promise.resolve(get_store_value(route.focusElement)).then(elem => {
    		const focusElement = elem || queryHeading(route.id);
    		if (!focusElement) {
    			warn(
    				ROUTER_ID,
    				"Could not find an element to focus. " +
    					"You should always render a header for accessibility reasons, " +
    					'or set a custom focus element via the "useFocus" hook. ' +
    					"If you don't want this Route or Router to manage focus, " +
    					'pass "primary={false}" to it.',
    				route,
    				ROUTE_ID,
    			);
    		}
    		const headingFocused = focus(focusElement);
    		if (headingFocused) return;
    		focus(document.documentElement);
    	});
    }

    const createTriggerFocus =
    	(a11yConfig, announcementText, location) =>
    	(manageFocus, announceNavigation) =>
    		// Wait until the dom is updated, so we can look for headings
    		tick().then(() => {
    			if (!focusCandidate || initialNavigation) {
    				initialNavigationOccurred();
    				return;
    			}
    			if (manageFocus) {
    				handleFocus(focusCandidate.route);
    			}
    			if (a11yConfig.announcements && announceNavigation) {
    				const { path, fullPath, meta, params, uri } = focusCandidate.route;
    				const announcementMessage = a11yConfig.createAnnouncement(
    					{ path, fullPath, meta, params, uri },
    					get_store_value(location),
    				);
    				Promise.resolve(announcementMessage).then(message => {
    					announcementText.set(message);
    				});
    			}
    			clearFocusCandidate();
    		});

    const visuallyHiddenStyle =
    	"position:fixed;" +
    	"top:-1px;" +
    	"left:0;" +
    	"width:1px;" +
    	"height:1px;" +
    	"padding:0;" +
    	"overflow:hidden;" +
    	"clip:rect(0,0,0,0);" +
    	"white-space:nowrap;" +
    	"border:0;";

    /* ../node_modules/svelte-navigator/src/Router.svelte generated by Svelte v3.52.0 */

    const file$4 = "../node_modules/svelte-navigator/src/Router.svelte";

    // (204:0) {#if isTopLevelRouter && manageFocus && a11yConfig.announcements}
    function create_if_block$2(ctx) {
    	let div;
    	let t;

    	let div_levels = [
    		{ role: "status" },
    		{ "aria-atomic": "true" },
    		{ "aria-live": "polite" },
    		{ "data-svnav-announcer": "" },
    		createInlineStyle(/*shouldDisableInlineStyles*/ ctx[6], visuallyHiddenStyle)
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*$announcementText*/ ctx[0]);
    			set_attributes(div, div_data);
    			add_location(div, file$4, 204, 1, 6149);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$announcementText*/ 1) set_data_dev(t, /*$announcementText*/ ctx[0]);

    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				{ role: "status" },
    				{ "aria-atomic": "true" },
    				{ "aria-live": "polite" },
    				{ "data-svnav-announcer": "" },
    				createInlineStyle(/*shouldDisableInlineStyles*/ ctx[6], visuallyHiddenStyle)
    			]));
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(204:0) {#if isTopLevelRouter && manageFocus && a11yConfig.announcements}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let if_block_anchor;
    	let current;

    	let div_levels = [
    		createMarkerProps(/*shouldDisableInlineStyles*/ ctx[6]),
    		{ "data-svnav-router": /*routerId*/ ctx[3] }
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const default_slot_template = /*#slots*/ ctx[22].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[21], null);
    	let if_block = /*isTopLevelRouter*/ ctx[2] && /*manageFocus*/ ctx[4] && /*a11yConfig*/ ctx[1].announcements && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = space();
    			if (default_slot) default_slot.c();
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			set_attributes(div, div_data);
    			add_location(div, file$4, 196, 0, 5982);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t0, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			set_attributes(div, div_data = get_spread_update(div_levels, [
    				createMarkerProps(/*shouldDisableInlineStyles*/ ctx[6]),
    				{ "data-svnav-router": /*routerId*/ ctx[3] }
    			]));

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 2097152)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[21],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[21])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[21], dirty, null),
    						null
    					);
    				}
    			}

    			if (/*isTopLevelRouter*/ ctx[2] && /*manageFocus*/ ctx[4] && /*a11yConfig*/ ctx[1].announcements) if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t0);
    			if (default_slot) default_slot.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const createId$1 = createCounter();
    const defaultBasepath = "/";

    function instance$4($$self, $$props, $$invalidate) {
    	let $location;
    	let $activeRoute;
    	let $prevLocation;
    	let $routes;
    	let $announcementText;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = defaultBasepath } = $$props;
    	let { url = null } = $$props;
    	let { history = globalHistory } = $$props;
    	let { primary = true } = $$props;
    	let { a11y = {} } = $$props;
    	let { disableInlineStyles = false } = $$props;

    	const a11yConfig = {
    		createAnnouncement: route => `Navigated to ${route.uri}`,
    		announcements: true,
    		...a11y
    	};

    	// Remember the initial `basepath`, so we can fire a warning
    	// when the user changes it later
    	const initialBasepath = basepath;

    	const normalizedBasepath = normalizePath(basepath);
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const isTopLevelRouter = !locationContext;
    	const routerId = createId$1();
    	const manageFocus = primary && !(routerContext && !routerContext.manageFocus);
    	const announcementText = writable("");
    	validate_store(announcementText, 'announcementText');
    	component_subscribe($$self, announcementText, value => $$invalidate(0, $announcementText = value));

    	const shouldDisableInlineStyles = routerContext
    	? routerContext.disableInlineStyles
    	: disableInlineStyles;

    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(20, $routes = value));
    	const activeRoute = writable(null);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(18, $activeRoute = value));

    	// Used in SSR to synchronously set that a Route is active.
    	let hasActiveRoute = false;

    	// Nesting level of router.
    	// We will need this to identify sibling routers, when moving
    	// focus on navigation, so we can focus the first possible router
    	const level = isTopLevelRouter ? 0 : routerContext.level + 1;

    	// If we're running an SSR we force the location to the `url` prop
    	const getInitialLocation = () => normalizeLocation(isSSR ? parsePath(url) : history.location, normalizedBasepath);

    	const location = isTopLevelRouter
    	? writable(getInitialLocation())
    	: locationContext;

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(17, $location = value));
    	const prevLocation = writable($location);
    	validate_store(prevLocation, 'prevLocation');
    	component_subscribe($$self, prevLocation, value => $$invalidate(19, $prevLocation = value));
    	const triggerFocus = createTriggerFocus(a11yConfig, announcementText, location);
    	const createRouteFilter = routeId => routeList => routeList.filter(routeItem => routeItem.id !== routeId);

    	function registerRoute(route) {
    		if (isSSR) {
    			// In SSR we should set the activeRoute immediately if it is a match.
    			// If there are more Routes being registered after a match is found,
    			// we just skip them.
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				hasActiveRoute = true;

    				// Return the match in SSR mode, so the matched Route can use it immediatly.
    				// Waiting for activeRoute to update does not work, because it updates
    				// after the Route is initialized
    				return matchingRoute; // eslint-disable-line consistent-return
    			}
    		} else {
    			routes.update(prevRoutes => {
    				// Remove an old version of the updated route,
    				// before pushing the new version
    				const nextRoutes = createRouteFilter(route.id)(prevRoutes);

    				nextRoutes.push(route);
    				return nextRoutes;
    			});
    		}
    	}

    	function unregisterRoute(routeId) {
    		routes.update(createRouteFilter(routeId));
    	}

    	if (!isTopLevelRouter && basepath !== defaultBasepath) {
    		warn(ROUTER_ID, 'Only top-level Routers can have a "basepath" prop. It is ignored.', { basepath });
    	}

    	if (isTopLevelRouter) {
    		// The topmost Router in the tree is responsible for updating
    		// the location store and supplying it through context.
    		onMount(() => {
    			const unlisten = history.listen(changedHistory => {
    				const normalizedLocation = normalizeLocation(changedHistory.location, normalizedBasepath);
    				prevLocation.set($location);
    				location.set(normalizedLocation);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		registerRoute,
    		unregisterRoute,
    		manageFocus,
    		level,
    		id: routerId,
    		history: isTopLevelRouter ? history : routerContext.history,
    		basepath: isTopLevelRouter
    		? normalizedBasepath
    		: routerContext.basepath,
    		disableInlineStyles: shouldDisableInlineStyles
    	});

    	const writable_props = ['basepath', 'url', 'history', 'primary', 'a11y', 'disableInlineStyles'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(11, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(12, url = $$props.url);
    		if ('history' in $$props) $$invalidate(13, history = $$props.history);
    		if ('primary' in $$props) $$invalidate(14, primary = $$props.primary);
    		if ('a11y' in $$props) $$invalidate(15, a11y = $$props.a11y);
    		if ('disableInlineStyles' in $$props) $$invalidate(16, disableInlineStyles = $$props.disableInlineStyles);
    		if ('$$scope' in $$props) $$invalidate(21, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createCounter,
    		createInlineStyle,
    		createMarkerProps,
    		createId: createId$1,
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		normalizePath,
    		pick,
    		match,
    		normalizeLocation,
    		parsePath,
    		isSSR,
    		warn,
    		ROUTER_ID,
    		pushFocusCandidate,
    		visuallyHiddenStyle,
    		createTriggerFocus,
    		defaultBasepath,
    		basepath,
    		url,
    		history,
    		primary,
    		a11y,
    		disableInlineStyles,
    		a11yConfig,
    		initialBasepath,
    		normalizedBasepath,
    		locationContext,
    		routerContext,
    		isTopLevelRouter,
    		routerId,
    		manageFocus,
    		announcementText,
    		shouldDisableInlineStyles,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		level,
    		getInitialLocation,
    		location,
    		prevLocation,
    		triggerFocus,
    		createRouteFilter,
    		registerRoute,
    		unregisterRoute,
    		$location,
    		$activeRoute,
    		$prevLocation,
    		$routes,
    		$announcementText
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(11, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(12, url = $$props.url);
    		if ('history' in $$props) $$invalidate(13, history = $$props.history);
    		if ('primary' in $$props) $$invalidate(14, primary = $$props.primary);
    		if ('a11y' in $$props) $$invalidate(15, a11y = $$props.a11y);
    		if ('disableInlineStyles' in $$props) $$invalidate(16, disableInlineStyles = $$props.disableInlineStyles);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*basepath*/ 2048) {
    			if (basepath !== initialBasepath) {
    				warn(ROUTER_ID, 'You cannot change the "basepath" prop. It is ignored.');
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$routes, $location*/ 1179648) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$location, $prevLocation*/ 655360) {
    			// Manage focus and announce navigation to screen reader users
    			{
    				if (isTopLevelRouter) {
    					const hasHash = !!$location.hash;

    					// When a hash is present in the url, we skip focus management, because
    					// focusing a different element will prevent in-page jumps (See #3)
    					const shouldManageFocus = !hasHash && manageFocus;

    					// We don't want to make an announcement, when the hash changes,
    					// but the active route stays the same
    					const announceNavigation = !hasHash || $location.pathname !== $prevLocation.pathname;

    					triggerFocus(shouldManageFocus, announceNavigation);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$activeRoute*/ 262144) {
    			// Queue matched Route, so top level Router can decide which Route to focus.
    			// Non primary Routers should just be ignored
    			if (manageFocus && $activeRoute && $activeRoute.primary) {
    				pushFocusCandidate({ level, routerId, route: $activeRoute });
    			}
    		}
    	};

    	return [
    		$announcementText,
    		a11yConfig,
    		isTopLevelRouter,
    		routerId,
    		manageFocus,
    		announcementText,
    		shouldDisableInlineStyles,
    		routes,
    		activeRoute,
    		location,
    		prevLocation,
    		basepath,
    		url,
    		history,
    		primary,
    		a11y,
    		disableInlineStyles,
    		$location,
    		$activeRoute,
    		$prevLocation,
    		$routes,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$4,
    			create_fragment$4,
    			safe_not_equal,
    			{
    				basepath: 11,
    				url: 12,
    				history: 13,
    				primary: 14,
    				a11y: 15,
    				disableInlineStyles: 16
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get history() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set history(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primary() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primary(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get a11y() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set a11y(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disableInlineStyles() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disableInlineStyles(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var Router$1 = Router;

    /**
     * Check if a component or hook have been created outside of a
     * context providing component
     * @param {number} componentId
     * @param {*} props
     * @param {string?} ctxKey
     * @param {number?} ctxProviderId
     */
    function usePreflightCheck(
    	componentId,
    	props,
    	ctxKey = ROUTER,
    	ctxProviderId = ROUTER_ID,
    ) {
    	const ctx = getContext(ctxKey);
    	if (!ctx) {
    		fail(
    			componentId,
    			label =>
    				`You cannot use ${label} outside of a ${createLabel(ctxProviderId)}.`,
    			props,
    		);
    	}
    }

    const toReadonly = ctx => {
    	const { subscribe } = getContext(ctx);
    	return { subscribe };
    };

    /**
     * Access the current location via a readable store.
     * @returns {import("svelte/store").Readable<{
        pathname: string;
        search: string;
        hash: string;
        state: {};
      }>}
     *
     * @example
      ```html
      <script>
        import { useLocation } from "svelte-navigator";

        const location = useLocation();

        $: console.log($location);
        // {
        //   pathname: "/blog",
        //   search: "?id=123",
        //   hash: "#comments",
        //   state: {}
        // }
      </script>
      ```
     */
    function useLocation() {
    	usePreflightCheck(USE_LOCATION_ID);
    	return toReadonly(LOCATION);
    }

    /**
     * @typedef {{
        path: string;
        fullPath: string;
        uri: string;
        params: {};
      }} RouteMatch
     */

    /**
     * @typedef {import("svelte/store").Readable<RouteMatch|null>} RouteMatchStore
     */

    /**
     * Access the history of top level Router.
     */
    function useHistory() {
    	const { history } = getContext(ROUTER);
    	return history;
    }

    /**
     * Access the base of the parent Route.
     */
    function useRouteBase() {
    	const route = getContext(ROUTE);
    	return route ? derived(route, _route => _route.base) : writable("/");
    }

    /**
     * Resolve a given link relative to the current `Route` and the `Router`s `basepath`.
     * It is used under the hood in `Link` and `useNavigate`.
     * You can use it to manually resolve links, when using the `link` or `links` actions.
     *
     * @returns {(path: string) => string}
     *
     * @example
      ```html
      <script>
        import { link, useResolve } from "svelte-navigator";

        const resolve = useResolve();
        // `resolvedLink` will be resolved relative to its parent Route
        // and the Routers `basepath`
        const resolvedLink = resolve("relativePath");
      </script>

      <a href={resolvedLink} use:link>Relative link</a>
      ```
     */
    function useResolve() {
    	usePreflightCheck(USE_RESOLVE_ID);
    	const routeBase = useRouteBase();
    	const { basepath: appBase } = getContext(ROUTER);
    	/**
    	 * Resolves the path relative to the current route and basepath.
    	 *
    	 * @param {string} path The path to resolve
    	 * @returns {string} The resolved path
    	 */
    	const resolve = path => resolveLink(path, get_store_value(routeBase), appBase);
    	return resolve;
    }

    /**
     * A hook, that returns a context-aware version of `navigate`.
     * It will automatically resolve the given link relative to the current Route.
     * It will also resolve a link against the `basepath` of the Router.
     *
     * @example
      ```html
      <!-- App.svelte -->
      <script>
        import { link, Route } from "svelte-navigator";
        import RouteComponent from "./RouteComponent.svelte";
      </script>

      <Router>
        <Route path="route1">
          <RouteComponent />
        </Route>
        <!-- ... -->
      </Router>

      <!-- RouteComponent.svelte -->
      <script>
        import { useNavigate } from "svelte-navigator";

        const navigate = useNavigate();
      </script>

      <button on:click="{() => navigate('relativePath')}">
        go to /route1/relativePath
      </button>
      <button on:click="{() => navigate('/absolutePath')}">
        go to /absolutePath
      </button>
      ```
      *
      * @example
      ```html
      <!-- App.svelte -->
      <script>
        import { link, Route } from "svelte-navigator";
        import RouteComponent from "./RouteComponent.svelte";
      </script>

      <Router basepath="/base">
        <Route path="route1">
          <RouteComponent />
        </Route>
        <!-- ... -->
      </Router>

      <!-- RouteComponent.svelte -->
      <script>
        import { useNavigate } from "svelte-navigator";

        const navigate = useNavigate();
      </script>

      <button on:click="{() => navigate('relativePath')}">
        go to /base/route1/relativePath
      </button>
      <button on:click="{() => navigate('/absolutePath')}">
        go to /base/absolutePath
      </button>
      ```
     */
    function useNavigate() {
    	usePreflightCheck(USE_NAVIGATE_ID);
    	const resolve = useResolve();
    	const { navigate } = useHistory();
    	/**
    	 * Navigate to a new route.
    	 * Resolves the link relative to the current route and basepath.
    	 *
    	 * @param {string|number} to The path to navigate to.
    	 *
    	 * If `to` is a number we will navigate to the stack entry index + `to`
    	 * (-> `navigate(-1)`, is equivalent to hitting the back button of the browser)
    	 * @param {Object} options
    	 * @param {*} [options.state]
    	 * @param {boolean} [options.replace=false]
    	 */
    	const navigateRelative = (to, options) => {
    		// If to is a number, we navigate to the target stack entry via `history.go`.
    		// Otherwise resolve the link
    		const target = isNumber(to) ? to : resolve(to);
    		return navigate(target, options);
    	};
    	return navigateRelative;
    }

    /* ../node_modules/svelte-navigator/src/Route.svelte generated by Svelte v3.52.0 */
    const file$3 = "../node_modules/svelte-navigator/src/Route.svelte";

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*$params*/ 16,
    	location: dirty & /*$location*/ 8
    });

    const get_default_slot_context = ctx => ({
    	params: isSSR ? get_store_value(/*params*/ ctx[10]) : /*$params*/ ctx[4],
    	location: /*$location*/ ctx[3],
    	navigate: /*navigate*/ ctx[11]
    });

    // (98:0) {#if isActive}
    function create_if_block$1(ctx) {
    	let router;
    	let current;

    	router = new Router$1({
    			props: {
    				primary: /*primary*/ ctx[1],
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const router_changes = {};
    			if (dirty & /*primary*/ 2) router_changes.primary = /*primary*/ ctx[1];

    			if (dirty & /*$$scope, component, $location, $params, $$restProps*/ 528409) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(98:0) {#if isActive}",
    		ctx
    	});

    	return block;
    }

    // (114:2) {:else}
    function create_else_block$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[18].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[19], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, $params, $location*/ 524312)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[19],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[19])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[19], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(114:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (106:2) {#if component !== null}
    function create_if_block_1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[3] },
    		{ navigate: /*navigate*/ ctx[11] },
    		isSSR ? get_store_value(/*params*/ ctx[10]) : /*$params*/ ctx[4],
    		/*$$restProps*/ ctx[12]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) mount_component(switch_instance, target, anchor);
    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, navigate, isSSR, get, params, $params, $$restProps*/ 7192)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 8 && { location: /*$location*/ ctx[3] },
    					dirty & /*navigate*/ 2048 && { navigate: /*navigate*/ ctx[11] },
    					dirty & /*isSSR, get, params, $params*/ 1040 && get_spread_object(isSSR ? get_store_value(/*params*/ ctx[10]) : /*$params*/ ctx[4]),
    					dirty & /*$$restProps*/ 4096 && get_spread_object(/*$$restProps*/ ctx[12])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(106:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    // (99:1) <Router {primary}>
    function create_default_slot$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(99:1) <Router {primary}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let current;

    	let div0_levels = [
    		createMarkerProps(/*disableInlineStyles*/ ctx[7]),
    		{ "data-svnav-route-start": /*id*/ ctx[5] }
    	];

    	let div0_data = {};

    	for (let i = 0; i < div0_levels.length; i += 1) {
    		div0_data = assign(div0_data, div0_levels[i]);
    	}

    	let if_block = /*isActive*/ ctx[2] && create_if_block$1(ctx);

    	let div1_levels = [
    		createMarkerProps(/*disableInlineStyles*/ ctx[7]),
    		{ "data-svnav-route-end": /*id*/ ctx[5] }
    	];

    	let div1_data = {};

    	for (let i = 0; i < div1_levels.length; i += 1) {
    		div1_data = assign(div1_data, div1_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			div1 = element("div");
    			set_attributes(div0, div0_data);
    			add_location(div0, file$3, 96, 0, 2664);
    			set_attributes(div1, div1_data);
    			add_location(div1, file$3, 122, 0, 3340);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			set_attributes(div0, div0_data = get_spread_update(div0_levels, [
    				createMarkerProps(/*disableInlineStyles*/ ctx[7]),
    				{ "data-svnav-route-start": /*id*/ ctx[5] }
    			]));

    			if (/*isActive*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isActive*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t1.parentNode, t1);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			set_attributes(div1, div1_data = get_spread_update(div1_levels, [
    				createMarkerProps(/*disableInlineStyles*/ ctx[7]),
    				{ "data-svnav-route-end": /*id*/ ctx[5] }
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const createId = createCounter();

    function instance$3($$self, $$props, $$invalidate) {
    	let isActive;
    	const omit_props_names = ["path","component","meta","primary"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $activeRoute;
    	let $location;
    	let $parentBase;
    	let $params;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	let { meta = {} } = $$props;
    	let { primary = true } = $$props;
    	usePreflightCheck(ROUTE_ID, $$props);
    	const id = createId();
    	const { registerRoute, unregisterRoute, activeRoute, disableInlineStyles } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(16, $activeRoute = value));
    	const parentBase = useRouteBase();
    	validate_store(parentBase, 'parentBase');
    	component_subscribe($$self, parentBase, value => $$invalidate(17, $parentBase = value));
    	const location = useLocation();
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(3, $location = value));
    	const focusElement = writable(null);

    	// In SSR we cannot wait for $activeRoute to update,
    	// so we use the match returned from `registerRoute` instead
    	let ssrMatch;

    	const route = writable();
    	const params = writable({});
    	validate_store(params, 'params');
    	component_subscribe($$self, params, value => $$invalidate(4, $params = value));
    	setContext(ROUTE, route);
    	setContext(ROUTE_PARAMS, params);
    	setContext(FOCUS_ELEM, focusElement);

    	// We need to call useNavigate after the route is set,
    	// so we can use the routes path for link resolution
    	const navigate = useNavigate();

    	// There is no need to unregister Routes in SSR since it will all be
    	// thrown away anyway
    	if (!isSSR) {
    		onDestroy(() => unregisterRoute(id));
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(24, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		$$invalidate(12, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('path' in $$new_props) $$invalidate(13, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('meta' in $$new_props) $$invalidate(14, meta = $$new_props.meta);
    		if ('primary' in $$new_props) $$invalidate(1, primary = $$new_props.primary);
    		if ('$$scope' in $$new_props) $$invalidate(19, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createCounter,
    		createMarkerProps,
    		createId,
    		getContext,
    		onDestroy,
    		setContext,
    		writable,
    		get: get_store_value,
    		Router: Router$1,
    		ROUTER,
    		ROUTE,
    		ROUTE_PARAMS,
    		FOCUS_ELEM,
    		useLocation,
    		useNavigate,
    		useRouteBase,
    		usePreflightCheck,
    		isSSR,
    		extractBaseUri,
    		join,
    		ROUTE_ID,
    		path,
    		component,
    		meta,
    		primary,
    		id,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		disableInlineStyles,
    		parentBase,
    		location,
    		focusElement,
    		ssrMatch,
    		route,
    		params,
    		navigate,
    		isActive,
    		$activeRoute,
    		$location,
    		$parentBase,
    		$params
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(24, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(13, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('meta' in $$props) $$invalidate(14, meta = $$new_props.meta);
    		if ('primary' in $$props) $$invalidate(1, primary = $$new_props.primary);
    		if ('ssrMatch' in $$props) $$invalidate(15, ssrMatch = $$new_props.ssrMatch);
    		if ('isActive' in $$props) $$invalidate(2, isActive = $$new_props.isActive);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*path, $parentBase, meta, $location, primary*/ 155658) {
    			{
    				// The route store will be re-computed whenever props, location or parentBase change
    				const isDefault = path === "";

    				const rawBase = join($parentBase, path);

    				const updatedRoute = {
    					id,
    					path,
    					meta,
    					// If no path prop is given, this Route will act as the default Route
    					// that is rendered if no other Route in the Router is a match
    					default: isDefault,
    					fullPath: isDefault ? "" : rawBase,
    					base: isDefault
    					? $parentBase
    					: extractBaseUri(rawBase, $location.pathname),
    					primary,
    					focusElement
    				};

    				route.set(updatedRoute);

    				// If we're in SSR mode and the Route matches,
    				// `registerRoute` will return the match
    				$$invalidate(15, ssrMatch = registerRoute(updatedRoute));
    			}
    		}

    		if ($$self.$$.dirty & /*ssrMatch, $activeRoute*/ 98304) {
    			$$invalidate(2, isActive = !!(ssrMatch || $activeRoute && $activeRoute.id === id));
    		}

    		if ($$self.$$.dirty & /*isActive, ssrMatch, $activeRoute*/ 98308) {
    			if (isActive) {
    				const { params: activeParams } = ssrMatch || $activeRoute;
    				params.set(activeParams);
    			}
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		primary,
    		isActive,
    		$location,
    		$params,
    		id,
    		activeRoute,
    		disableInlineStyles,
    		parentBase,
    		location,
    		params,
    		navigate,
    		$$restProps,
    		path,
    		meta,
    		ssrMatch,
    		$activeRoute,
    		$parentBase,
    		slots,
    		$$scope
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			path: 13,
    			component: 0,
    			meta: 14,
    			primary: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get meta() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set meta(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primary() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primary(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var Route$1 = Route;

    /* ../node_modules/svelte-navigator/src/Link.svelte generated by Svelte v3.52.0 */
    const file$2 = "../node_modules/svelte-navigator/src/Link.svelte";

    function create_fragment$2(ctx) {
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[13].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], null);
    	let a_levels = [{ href: /*href*/ ctx[0] }, /*ariaCurrent*/ ctx[2], /*props*/ ctx[1]];
    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			set_attributes(a, a_data);
    			add_location(a, file$2, 65, 0, 1861);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*onClick*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4096)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[12],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[12])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, null),
    						null
    					);
    				}
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				(!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
    				dirty & /*ariaCurrent*/ 4 && /*ariaCurrent*/ ctx[2],
    				dirty & /*props*/ 2 && /*props*/ ctx[1]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let href;
    	let isPartiallyCurrent;
    	let isCurrent;
    	let isExactCurrent;
    	let ariaCurrent;
    	let props;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Link', slots, ['default']);
    	let { to } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = null } = $$props;
    	usePreflightCheck(LINK_ID, $$props);
    	const location = useLocation();
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(11, $location = value));
    	const dispatch = createEventDispatcher();
    	const resolve = useResolve();
    	const { navigate } = useHistory();

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = isExactCurrent || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (to === undefined && !('to' in $$props || $$self.$$.bound[$$self.$$.props['to']])) {
    			console.warn("<Link> was created without expected prop 'to'");
    		}
    	});

    	$$self.$$set = $$new_props => {
    		$$invalidate(19, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		$$invalidate(18, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('to' in $$new_props) $$invalidate(5, to = $$new_props.to);
    		if ('replace' in $$new_props) $$invalidate(6, replace = $$new_props.replace);
    		if ('state' in $$new_props) $$invalidate(7, state = $$new_props.state);
    		if ('getProps' in $$new_props) $$invalidate(8, getProps = $$new_props.getProps);
    		if ('$$scope' in $$new_props) $$invalidate(12, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		useLocation,
    		useResolve,
    		useHistory,
    		usePreflightCheck,
    		shouldNavigate,
    		isFunction,
    		startsWith,
    		LINK_ID,
    		parsePath,
    		stringifyPath,
    		to,
    		replace,
    		state,
    		getProps,
    		location,
    		dispatch,
    		resolve,
    		navigate,
    		onClick,
    		href,
    		isExactCurrent,
    		isCurrent,
    		isPartiallyCurrent,
    		props,
    		ariaCurrent,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(19, $$props = assign(assign({}, $$props), $$new_props));
    		if ('to' in $$props) $$invalidate(5, to = $$new_props.to);
    		if ('replace' in $$props) $$invalidate(6, replace = $$new_props.replace);
    		if ('state' in $$props) $$invalidate(7, state = $$new_props.state);
    		if ('getProps' in $$props) $$invalidate(8, getProps = $$new_props.getProps);
    		if ('href' in $$props) $$invalidate(0, href = $$new_props.href);
    		if ('isExactCurrent' in $$props) isExactCurrent = $$new_props.isExactCurrent;
    		if ('isCurrent' in $$props) $$invalidate(9, isCurrent = $$new_props.isCurrent);
    		if ('isPartiallyCurrent' in $$props) $$invalidate(10, isPartiallyCurrent = $$new_props.isPartiallyCurrent);
    		if ('props' in $$props) $$invalidate(1, props = $$new_props.props);
    		if ('ariaCurrent' in $$props) $$invalidate(2, ariaCurrent = $$new_props.ariaCurrent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $location*/ 2080) {
    			// We need to pass location here to force re-resolution of the link,
    			// when the pathname changes. Otherwise we could end up with stale path params,
    			// when for example an :id changes in the parent Routes path
    			$$invalidate(0, href = resolve(to, $location));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 2049) {
    			$$invalidate(10, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 2049) {
    			$$invalidate(9, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 2049) {
    			isExactCurrent = parsePath(href) === stringifyPath($location);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 512) {
    			$$invalidate(2, ariaCurrent = isCurrent ? { "aria-current": "page" } : {});
    		}

    		$$invalidate(1, props = (() => {
    			if (isFunction(getProps)) {
    				const dynamicProps = getProps({
    					location: $location,
    					href,
    					isPartiallyCurrent,
    					isCurrent
    				});

    				return { ...$$restProps, ...dynamicProps };
    			}

    			return $$restProps;
    		})());
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		href,
    		props,
    		ariaCurrent,
    		location,
    		onClick,
    		to,
    		replace,
    		state,
    		getProps,
    		isCurrent,
    		isPartiallyCurrent,
    		$location,
    		$$scope,
    		slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { to: 5, replace: 6, state: 7, getProps: 8 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var Link$1 = Link;

    const appWebsocketContext = 'appWebsocket';
    const appInfoContext = 'appInfo';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$6(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$5(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles$5 = i$2 `:host{font-family:var(--mdc-icon-font, "Material Icons");font-weight:normal;font-style:normal;font-size:var(--mdc-icon-size, 24px);line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;font-feature-settings:"liga"}`;

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    let Icon = class Icon extends s$1 {
        /** @soyTemplate */
        render() {
            return y `<span><slot></slot></span>`;
        }
    };
    Icon.styles = [styles$5];
    Icon = __decorate$5([
        e$a('mwc-icon')
    ], Icon);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$4(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    function matches(element, selector) {
        var nativeMatches = element.matches
            || element.webkitMatchesSelector
            || element.msMatchesSelector;
        return nativeMatches.call(element, selector);
    }

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    function addHasRemoveClass(element) {
        return {
            addClass: (className) => {
                element.classList.add(className);
            },
            removeClass: (className) => {
                element.classList.remove(className);
            },
            hasClass: (className) => element.classList.contains(className),
        };
    }
    const fn = () => { };
    const optionsBlock = {
        get passive() {
            return false;
        }
    };
    document.addEventListener('x', fn, optionsBlock);
    document.removeEventListener('x', fn);

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    class BaseElement extends s$1 {
        click() {
            if (this.mdcRoot) {
                this.mdcRoot.focus();
                this.mdcRoot.click();
                return;
            }
            super.click();
        }
        /**
         * Create and attach the MDC Foundation to the instance
         */
        createFoundation() {
            if (this.mdcFoundation !== undefined) {
                this.mdcFoundation.destroy();
            }
            if (this.mdcFoundationClass) {
                this.mdcFoundation = new this.mdcFoundationClass(this.createAdapter());
                this.mdcFoundation.init();
            }
        }
        firstUpdated() {
            this.createFoundation();
        }
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$4 = function(d, b) {
        extendStatics$4 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics$4(d, b);
    };

    function __extends$4(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics$4(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$4 = function() {
        __assign$4 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$4.apply(this, arguments);
    };

    function __values$2(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFoundation = /** @class */ (function () {
        function MDCFoundation(adapter) {
            if (adapter === void 0) { adapter = {}; }
            this.adapter = adapter;
        }
        Object.defineProperty(MDCFoundation, "cssClasses", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports every
                // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'mdc-component--active'}
                return {};
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "strings", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
                return {};
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "numbers", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
                return {};
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "defaultAdapter", {
            get: function () {
                // Classes extending MDCFoundation may choose to implement this getter in order to provide a convenient
                // way of viewing the necessary methods of an adapter. In the future, this could also be used for adapter
                // validation.
                return {};
            },
            enumerable: false,
            configurable: true
        });
        MDCFoundation.prototype.init = function () {
            // Subclasses should override this method to perform initialization routines (registering events, etc.)
        };
        MDCFoundation.prototype.destroy = function () {
            // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
        };
        return MDCFoundation;
    }());

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$4 = {
        // Ripple is a special case where the "root" component is really a "mixin" of sorts,
        // given that it's an 'upgrade' to an existing component. That being said it is the root
        // CSS class that all other CSS classes derive from.
        BG_FOCUSED: 'mdc-ripple-upgraded--background-focused',
        FG_ACTIVATION: 'mdc-ripple-upgraded--foreground-activation',
        FG_DEACTIVATION: 'mdc-ripple-upgraded--foreground-deactivation',
        ROOT: 'mdc-ripple-upgraded',
        UNBOUNDED: 'mdc-ripple-upgraded--unbounded',
    };
    var strings$2 = {
        VAR_FG_SCALE: '--mdc-ripple-fg-scale',
        VAR_FG_SIZE: '--mdc-ripple-fg-size',
        VAR_FG_TRANSLATE_END: '--mdc-ripple-fg-translate-end',
        VAR_FG_TRANSLATE_START: '--mdc-ripple-fg-translate-start',
        VAR_LEFT: '--mdc-ripple-left',
        VAR_TOP: '--mdc-ripple-top',
    };
    var numbers$2 = {
        DEACTIVATION_TIMEOUT_MS: 225,
        FG_DEACTIVATION_MS: 150,
        INITIAL_ORIGIN_SCALE: 0.6,
        PADDING: 10,
        TAP_DELAY_MS: 300, // Delay between touch and simulated mouse events on touch devices
    };

    /**
     * Stores result from supportsCssVariables to avoid redundant processing to
     * detect CSS custom variable support.
     */
    function getNormalizedEventCoords(evt, pageOffset, clientRect) {
        if (!evt) {
            return { x: 0, y: 0 };
        }
        var x = pageOffset.x, y = pageOffset.y;
        var documentX = x + clientRect.left;
        var documentY = y + clientRect.top;
        var normalizedX;
        var normalizedY;
        // Determine touch point relative to the ripple container.
        if (evt.type === 'touchstart') {
            var touchEvent = evt;
            normalizedX = touchEvent.changedTouches[0].pageX - documentX;
            normalizedY = touchEvent.changedTouches[0].pageY - documentY;
        }
        else {
            var mouseEvent = evt;
            normalizedX = mouseEvent.pageX - documentX;
            normalizedY = mouseEvent.pageY - documentY;
        }
        return { x: normalizedX, y: normalizedY };
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    // Activation events registered on the root element of each instance for activation
    var ACTIVATION_EVENT_TYPES = [
        'touchstart', 'pointerdown', 'mousedown', 'keydown',
    ];
    // Deactivation events registered on documentElement when a pointer-related down event occurs
    var POINTER_DEACTIVATION_EVENT_TYPES = [
        'touchend', 'pointerup', 'mouseup', 'contextmenu',
    ];
    // simultaneous nested activations
    var activatedTargets = [];
    var MDCRippleFoundation = /** @class */ (function (_super) {
        __extends$4(MDCRippleFoundation, _super);
        function MDCRippleFoundation(adapter) {
            var _this = _super.call(this, __assign$4(__assign$4({}, MDCRippleFoundation.defaultAdapter), adapter)) || this;
            _this.activationAnimationHasEnded = false;
            _this.activationTimer = 0;
            _this.fgDeactivationRemovalTimer = 0;
            _this.fgScale = '0';
            _this.frame = { width: 0, height: 0 };
            _this.initialSize = 0;
            _this.layoutFrame = 0;
            _this.maxRadius = 0;
            _this.unboundedCoords = { left: 0, top: 0 };
            _this.activationState = _this.defaultActivationState();
            _this.activationTimerCallback = function () {
                _this.activationAnimationHasEnded = true;
                _this.runDeactivationUXLogicIfReady();
            };
            _this.activateHandler = function (e) {
                _this.activateImpl(e);
            };
            _this.deactivateHandler = function () {
                _this.deactivateImpl();
            };
            _this.focusHandler = function () {
                _this.handleFocus();
            };
            _this.blurHandler = function () {
                _this.handleBlur();
            };
            _this.resizeHandler = function () {
                _this.layout();
            };
            return _this;
        }
        Object.defineProperty(MDCRippleFoundation, "cssClasses", {
            get: function () {
                return cssClasses$4;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "strings", {
            get: function () {
                return strings$2;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "numbers", {
            get: function () {
                return numbers$2;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addClass: function () { return undefined; },
                    browserSupportsCssVars: function () { return true; },
                    computeBoundingRect: function () {
                        return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
                    },
                    containsEventTarget: function () { return true; },
                    deregisterDocumentInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                    deregisterResizeHandler: function () { return undefined; },
                    getWindowPageOffset: function () { return ({ x: 0, y: 0 }); },
                    isSurfaceActive: function () { return true; },
                    isSurfaceDisabled: function () { return true; },
                    isUnbounded: function () { return true; },
                    registerDocumentInteractionHandler: function () { return undefined; },
                    registerInteractionHandler: function () { return undefined; },
                    registerResizeHandler: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    updateCssVariable: function () { return undefined; },
                };
            },
            enumerable: false,
            configurable: true
        });
        MDCRippleFoundation.prototype.init = function () {
            var _this = this;
            var supportsPressRipple = this.supportsPressRipple();
            this.registerRootHandlers(supportsPressRipple);
            if (supportsPressRipple) {
                var _a = MDCRippleFoundation.cssClasses, ROOT_1 = _a.ROOT, UNBOUNDED_1 = _a.UNBOUNDED;
                requestAnimationFrame(function () {
                    _this.adapter.addClass(ROOT_1);
                    if (_this.adapter.isUnbounded()) {
                        _this.adapter.addClass(UNBOUNDED_1);
                        // Unbounded ripples need layout logic applied immediately to set coordinates for both shade and ripple
                        _this.layoutInternal();
                    }
                });
            }
        };
        MDCRippleFoundation.prototype.destroy = function () {
            var _this = this;
            if (this.supportsPressRipple()) {
                if (this.activationTimer) {
                    clearTimeout(this.activationTimer);
                    this.activationTimer = 0;
                    this.adapter.removeClass(MDCRippleFoundation.cssClasses.FG_ACTIVATION);
                }
                if (this.fgDeactivationRemovalTimer) {
                    clearTimeout(this.fgDeactivationRemovalTimer);
                    this.fgDeactivationRemovalTimer = 0;
                    this.adapter.removeClass(MDCRippleFoundation.cssClasses.FG_DEACTIVATION);
                }
                var _a = MDCRippleFoundation.cssClasses, ROOT_2 = _a.ROOT, UNBOUNDED_2 = _a.UNBOUNDED;
                requestAnimationFrame(function () {
                    _this.adapter.removeClass(ROOT_2);
                    _this.adapter.removeClass(UNBOUNDED_2);
                    _this.removeCssVars();
                });
            }
            this.deregisterRootHandlers();
            this.deregisterDeactivationHandlers();
        };
        /**
         * @param evt Optional event containing position information.
         */
        MDCRippleFoundation.prototype.activate = function (evt) {
            this.activateImpl(evt);
        };
        MDCRippleFoundation.prototype.deactivate = function () {
            this.deactivateImpl();
        };
        MDCRippleFoundation.prototype.layout = function () {
            var _this = this;
            if (this.layoutFrame) {
                cancelAnimationFrame(this.layoutFrame);
            }
            this.layoutFrame = requestAnimationFrame(function () {
                _this.layoutInternal();
                _this.layoutFrame = 0;
            });
        };
        MDCRippleFoundation.prototype.setUnbounded = function (unbounded) {
            var UNBOUNDED = MDCRippleFoundation.cssClasses.UNBOUNDED;
            if (unbounded) {
                this.adapter.addClass(UNBOUNDED);
            }
            else {
                this.adapter.removeClass(UNBOUNDED);
            }
        };
        MDCRippleFoundation.prototype.handleFocus = function () {
            var _this = this;
            requestAnimationFrame(function () { return _this.adapter.addClass(MDCRippleFoundation.cssClasses.BG_FOCUSED); });
        };
        MDCRippleFoundation.prototype.handleBlur = function () {
            var _this = this;
            requestAnimationFrame(function () { return _this.adapter.removeClass(MDCRippleFoundation.cssClasses.BG_FOCUSED); });
        };
        /**
         * We compute this property so that we are not querying information about the client
         * until the point in time where the foundation requests it. This prevents scenarios where
         * client-side feature-detection may happen too early, such as when components are rendered on the server
         * and then initialized at mount time on the client.
         */
        MDCRippleFoundation.prototype.supportsPressRipple = function () {
            return this.adapter.browserSupportsCssVars();
        };
        MDCRippleFoundation.prototype.defaultActivationState = function () {
            return {
                activationEvent: undefined,
                hasDeactivationUXRun: false,
                isActivated: false,
                isProgrammatic: false,
                wasActivatedByPointer: false,
                wasElementMadeActive: false,
            };
        };
        /**
         * supportsPressRipple Passed from init to save a redundant function call
         */
        MDCRippleFoundation.prototype.registerRootHandlers = function (supportsPressRipple) {
            var e_1, _a;
            if (supportsPressRipple) {
                try {
                    for (var ACTIVATION_EVENT_TYPES_1 = __values$2(ACTIVATION_EVENT_TYPES), ACTIVATION_EVENT_TYPES_1_1 = ACTIVATION_EVENT_TYPES_1.next(); !ACTIVATION_EVENT_TYPES_1_1.done; ACTIVATION_EVENT_TYPES_1_1 = ACTIVATION_EVENT_TYPES_1.next()) {
                        var evtType = ACTIVATION_EVENT_TYPES_1_1.value;
                        this.adapter.registerInteractionHandler(evtType, this.activateHandler);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (ACTIVATION_EVENT_TYPES_1_1 && !ACTIVATION_EVENT_TYPES_1_1.done && (_a = ACTIVATION_EVENT_TYPES_1.return)) _a.call(ACTIVATION_EVENT_TYPES_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                if (this.adapter.isUnbounded()) {
                    this.adapter.registerResizeHandler(this.resizeHandler);
                }
            }
            this.adapter.registerInteractionHandler('focus', this.focusHandler);
            this.adapter.registerInteractionHandler('blur', this.blurHandler);
        };
        MDCRippleFoundation.prototype.registerDeactivationHandlers = function (evt) {
            var e_2, _a;
            if (evt.type === 'keydown') {
                this.adapter.registerInteractionHandler('keyup', this.deactivateHandler);
            }
            else {
                try {
                    for (var POINTER_DEACTIVATION_EVENT_TYPES_1 = __values$2(POINTER_DEACTIVATION_EVENT_TYPES), POINTER_DEACTIVATION_EVENT_TYPES_1_1 = POINTER_DEACTIVATION_EVENT_TYPES_1.next(); !POINTER_DEACTIVATION_EVENT_TYPES_1_1.done; POINTER_DEACTIVATION_EVENT_TYPES_1_1 = POINTER_DEACTIVATION_EVENT_TYPES_1.next()) {
                        var evtType = POINTER_DEACTIVATION_EVENT_TYPES_1_1.value;
                        this.adapter.registerDocumentInteractionHandler(evtType, this.deactivateHandler);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (POINTER_DEACTIVATION_EVENT_TYPES_1_1 && !POINTER_DEACTIVATION_EVENT_TYPES_1_1.done && (_a = POINTER_DEACTIVATION_EVENT_TYPES_1.return)) _a.call(POINTER_DEACTIVATION_EVENT_TYPES_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        };
        MDCRippleFoundation.prototype.deregisterRootHandlers = function () {
            var e_3, _a;
            try {
                for (var ACTIVATION_EVENT_TYPES_2 = __values$2(ACTIVATION_EVENT_TYPES), ACTIVATION_EVENT_TYPES_2_1 = ACTIVATION_EVENT_TYPES_2.next(); !ACTIVATION_EVENT_TYPES_2_1.done; ACTIVATION_EVENT_TYPES_2_1 = ACTIVATION_EVENT_TYPES_2.next()) {
                    var evtType = ACTIVATION_EVENT_TYPES_2_1.value;
                    this.adapter.deregisterInteractionHandler(evtType, this.activateHandler);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (ACTIVATION_EVENT_TYPES_2_1 && !ACTIVATION_EVENT_TYPES_2_1.done && (_a = ACTIVATION_EVENT_TYPES_2.return)) _a.call(ACTIVATION_EVENT_TYPES_2);
                }
                finally { if (e_3) throw e_3.error; }
            }
            this.adapter.deregisterInteractionHandler('focus', this.focusHandler);
            this.adapter.deregisterInteractionHandler('blur', this.blurHandler);
            if (this.adapter.isUnbounded()) {
                this.adapter.deregisterResizeHandler(this.resizeHandler);
            }
        };
        MDCRippleFoundation.prototype.deregisterDeactivationHandlers = function () {
            var e_4, _a;
            this.adapter.deregisterInteractionHandler('keyup', this.deactivateHandler);
            try {
                for (var POINTER_DEACTIVATION_EVENT_TYPES_2 = __values$2(POINTER_DEACTIVATION_EVENT_TYPES), POINTER_DEACTIVATION_EVENT_TYPES_2_1 = POINTER_DEACTIVATION_EVENT_TYPES_2.next(); !POINTER_DEACTIVATION_EVENT_TYPES_2_1.done; POINTER_DEACTIVATION_EVENT_TYPES_2_1 = POINTER_DEACTIVATION_EVENT_TYPES_2.next()) {
                    var evtType = POINTER_DEACTIVATION_EVENT_TYPES_2_1.value;
                    this.adapter.deregisterDocumentInteractionHandler(evtType, this.deactivateHandler);
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (POINTER_DEACTIVATION_EVENT_TYPES_2_1 && !POINTER_DEACTIVATION_EVENT_TYPES_2_1.done && (_a = POINTER_DEACTIVATION_EVENT_TYPES_2.return)) _a.call(POINTER_DEACTIVATION_EVENT_TYPES_2);
                }
                finally { if (e_4) throw e_4.error; }
            }
        };
        MDCRippleFoundation.prototype.removeCssVars = function () {
            var _this = this;
            var rippleStrings = MDCRippleFoundation.strings;
            var keys = Object.keys(rippleStrings);
            keys.forEach(function (key) {
                if (key.indexOf('VAR_') === 0) {
                    _this.adapter.updateCssVariable(rippleStrings[key], null);
                }
            });
        };
        MDCRippleFoundation.prototype.activateImpl = function (evt) {
            var _this = this;
            if (this.adapter.isSurfaceDisabled()) {
                return;
            }
            var activationState = this.activationState;
            if (activationState.isActivated) {
                return;
            }
            // Avoid reacting to follow-on events fired by touch device after an already-processed user interaction
            var previousActivationEvent = this.previousActivationEvent;
            var isSameInteraction = previousActivationEvent && evt !== undefined && previousActivationEvent.type !== evt.type;
            if (isSameInteraction) {
                return;
            }
            activationState.isActivated = true;
            activationState.isProgrammatic = evt === undefined;
            activationState.activationEvent = evt;
            activationState.wasActivatedByPointer = activationState.isProgrammatic ? false : evt !== undefined && (evt.type === 'mousedown' || evt.type === 'touchstart' || evt.type === 'pointerdown');
            var hasActivatedChild = evt !== undefined &&
                activatedTargets.length > 0 &&
                activatedTargets.some(function (target) { return _this.adapter.containsEventTarget(target); });
            if (hasActivatedChild) {
                // Immediately reset activation state, while preserving logic that prevents touch follow-on events
                this.resetActivationState();
                return;
            }
            if (evt !== undefined) {
                activatedTargets.push(evt.target);
                this.registerDeactivationHandlers(evt);
            }
            activationState.wasElementMadeActive = this.checkElementMadeActive(evt);
            if (activationState.wasElementMadeActive) {
                this.animateActivation();
            }
            requestAnimationFrame(function () {
                // Reset array on next frame after the current event has had a chance to bubble to prevent ancestor ripples
                activatedTargets = [];
                if (!activationState.wasElementMadeActive
                    && evt !== undefined
                    && (evt.key === ' ' || evt.keyCode === 32)) {
                    // If space was pressed, try again within an rAF call to detect :active, because different UAs report
                    // active states inconsistently when they're called within event handling code:
                    // - https://bugs.chromium.org/p/chromium/issues/detail?id=635971
                    // - https://bugzilla.mozilla.org/show_bug.cgi?id=1293741
                    // We try first outside rAF to support Edge, which does not exhibit this problem, but will crash if a CSS
                    // variable is set within a rAF callback for a submit button interaction (#2241).
                    activationState.wasElementMadeActive = _this.checkElementMadeActive(evt);
                    if (activationState.wasElementMadeActive) {
                        _this.animateActivation();
                    }
                }
                if (!activationState.wasElementMadeActive) {
                    // Reset activation state immediately if element was not made active.
                    _this.activationState = _this.defaultActivationState();
                }
            });
        };
        MDCRippleFoundation.prototype.checkElementMadeActive = function (evt) {
            return (evt !== undefined && evt.type === 'keydown') ?
                this.adapter.isSurfaceActive() :
                true;
        };
        MDCRippleFoundation.prototype.animateActivation = function () {
            var _this = this;
            var _a = MDCRippleFoundation.strings, VAR_FG_TRANSLATE_START = _a.VAR_FG_TRANSLATE_START, VAR_FG_TRANSLATE_END = _a.VAR_FG_TRANSLATE_END;
            var _b = MDCRippleFoundation.cssClasses, FG_DEACTIVATION = _b.FG_DEACTIVATION, FG_ACTIVATION = _b.FG_ACTIVATION;
            var DEACTIVATION_TIMEOUT_MS = MDCRippleFoundation.numbers.DEACTIVATION_TIMEOUT_MS;
            this.layoutInternal();
            var translateStart = '';
            var translateEnd = '';
            if (!this.adapter.isUnbounded()) {
                var _c = this.getFgTranslationCoordinates(), startPoint = _c.startPoint, endPoint = _c.endPoint;
                translateStart = startPoint.x + "px, " + startPoint.y + "px";
                translateEnd = endPoint.x + "px, " + endPoint.y + "px";
            }
            this.adapter.updateCssVariable(VAR_FG_TRANSLATE_START, translateStart);
            this.adapter.updateCssVariable(VAR_FG_TRANSLATE_END, translateEnd);
            // Cancel any ongoing activation/deactivation animations
            clearTimeout(this.activationTimer);
            clearTimeout(this.fgDeactivationRemovalTimer);
            this.rmBoundedActivationClasses();
            this.adapter.removeClass(FG_DEACTIVATION);
            // Force layout in order to re-trigger the animation.
            this.adapter.computeBoundingRect();
            this.adapter.addClass(FG_ACTIVATION);
            this.activationTimer = setTimeout(function () {
                _this.activationTimerCallback();
            }, DEACTIVATION_TIMEOUT_MS);
        };
        MDCRippleFoundation.prototype.getFgTranslationCoordinates = function () {
            var _a = this.activationState, activationEvent = _a.activationEvent, wasActivatedByPointer = _a.wasActivatedByPointer;
            var startPoint;
            if (wasActivatedByPointer) {
                startPoint = getNormalizedEventCoords(activationEvent, this.adapter.getWindowPageOffset(), this.adapter.computeBoundingRect());
            }
            else {
                startPoint = {
                    x: this.frame.width / 2,
                    y: this.frame.height / 2,
                };
            }
            // Center the element around the start point.
            startPoint = {
                x: startPoint.x - (this.initialSize / 2),
                y: startPoint.y - (this.initialSize / 2),
            };
            var endPoint = {
                x: (this.frame.width / 2) - (this.initialSize / 2),
                y: (this.frame.height / 2) - (this.initialSize / 2),
            };
            return { startPoint: startPoint, endPoint: endPoint };
        };
        MDCRippleFoundation.prototype.runDeactivationUXLogicIfReady = function () {
            var _this = this;
            // This method is called both when a pointing device is released, and when the activation animation ends.
            // The deactivation animation should only run after both of those occur.
            var FG_DEACTIVATION = MDCRippleFoundation.cssClasses.FG_DEACTIVATION;
            var _a = this.activationState, hasDeactivationUXRun = _a.hasDeactivationUXRun, isActivated = _a.isActivated;
            var activationHasEnded = hasDeactivationUXRun || !isActivated;
            if (activationHasEnded && this.activationAnimationHasEnded) {
                this.rmBoundedActivationClasses();
                this.adapter.addClass(FG_DEACTIVATION);
                this.fgDeactivationRemovalTimer = setTimeout(function () {
                    _this.adapter.removeClass(FG_DEACTIVATION);
                }, numbers$2.FG_DEACTIVATION_MS);
            }
        };
        MDCRippleFoundation.prototype.rmBoundedActivationClasses = function () {
            var FG_ACTIVATION = MDCRippleFoundation.cssClasses.FG_ACTIVATION;
            this.adapter.removeClass(FG_ACTIVATION);
            this.activationAnimationHasEnded = false;
            this.adapter.computeBoundingRect();
        };
        MDCRippleFoundation.prototype.resetActivationState = function () {
            var _this = this;
            this.previousActivationEvent = this.activationState.activationEvent;
            this.activationState = this.defaultActivationState();
            // Touch devices may fire additional events for the same interaction within a short time.
            // Store the previous event until it's safe to assume that subsequent events are for new interactions.
            setTimeout(function () { return _this.previousActivationEvent = undefined; }, MDCRippleFoundation.numbers.TAP_DELAY_MS);
        };
        MDCRippleFoundation.prototype.deactivateImpl = function () {
            var _this = this;
            var activationState = this.activationState;
            // This can happen in scenarios such as when you have a keyup event that blurs the element.
            if (!activationState.isActivated) {
                return;
            }
            var state = __assign$4({}, activationState);
            if (activationState.isProgrammatic) {
                requestAnimationFrame(function () {
                    _this.animateDeactivation(state);
                });
                this.resetActivationState();
            }
            else {
                this.deregisterDeactivationHandlers();
                requestAnimationFrame(function () {
                    _this.activationState.hasDeactivationUXRun = true;
                    _this.animateDeactivation(state);
                    _this.resetActivationState();
                });
            }
        };
        MDCRippleFoundation.prototype.animateDeactivation = function (_a) {
            var wasActivatedByPointer = _a.wasActivatedByPointer, wasElementMadeActive = _a.wasElementMadeActive;
            if (wasActivatedByPointer || wasElementMadeActive) {
                this.runDeactivationUXLogicIfReady();
            }
        };
        MDCRippleFoundation.prototype.layoutInternal = function () {
            var _this = this;
            this.frame = this.adapter.computeBoundingRect();
            var maxDim = Math.max(this.frame.height, this.frame.width);
            // Surface diameter is treated differently for unbounded vs. bounded ripples.
            // Unbounded ripple diameter is calculated smaller since the surface is expected to already be padded appropriately
            // to extend the hitbox, and the ripple is expected to meet the edges of the padded hitbox (which is typically
            // square). Bounded ripples, on the other hand, are fully expected to expand beyond the surface's longest diameter
            // (calculated based on the diagonal plus a constant padding), and are clipped at the surface's border via
            // `overflow: hidden`.
            var getBoundedRadius = function () {
                var hypotenuse = Math.sqrt(Math.pow(_this.frame.width, 2) + Math.pow(_this.frame.height, 2));
                return hypotenuse + MDCRippleFoundation.numbers.PADDING;
            };
            this.maxRadius = this.adapter.isUnbounded() ? maxDim : getBoundedRadius();
            // Ripple is sized as a fraction of the largest dimension of the surface, then scales up using a CSS scale transform
            var initialSize = Math.floor(maxDim * MDCRippleFoundation.numbers.INITIAL_ORIGIN_SCALE);
            // Unbounded ripple size should always be even number to equally center align.
            if (this.adapter.isUnbounded() && initialSize % 2 !== 0) {
                this.initialSize = initialSize - 1;
            }
            else {
                this.initialSize = initialSize;
            }
            this.fgScale = "" + this.maxRadius / this.initialSize;
            this.updateLayoutCssVars();
        };
        MDCRippleFoundation.prototype.updateLayoutCssVars = function () {
            var _a = MDCRippleFoundation.strings, VAR_FG_SIZE = _a.VAR_FG_SIZE, VAR_LEFT = _a.VAR_LEFT, VAR_TOP = _a.VAR_TOP, VAR_FG_SCALE = _a.VAR_FG_SCALE;
            this.adapter.updateCssVariable(VAR_FG_SIZE, this.initialSize + "px");
            this.adapter.updateCssVariable(VAR_FG_SCALE, this.fgScale);
            if (this.adapter.isUnbounded()) {
                this.unboundedCoords = {
                    left: Math.round((this.frame.width / 2) - (this.initialSize / 2)),
                    top: Math.round((this.frame.height / 2) - (this.initialSize / 2)),
                };
                this.adapter.updateCssVariable(VAR_LEFT, this.unboundedCoords.left + "px");
                this.adapter.updateCssVariable(VAR_TOP, this.unboundedCoords.top + "px");
            }
        };
        return MDCRippleFoundation;
    }(MDCFoundation));
    // tslint:disable-next-line:no-default-export Needed for backward compatibility with MDC Web v0.44.0 and earlier.
    var MDCRippleFoundation$1 = MDCRippleFoundation;

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    class RippleBase extends BaseElement {
        constructor() {
            super(...arguments);
            this.primary = false;
            this.accent = false;
            this.unbounded = false;
            this.disabled = false;
            this.activated = false;
            this.selected = false;
            this.internalUseStateLayerCustomProperties = false;
            this.hovering = false;
            this.bgFocused = false;
            this.fgActivation = false;
            this.fgDeactivation = false;
            this.fgScale = '';
            this.fgSize = '';
            this.translateStart = '';
            this.translateEnd = '';
            this.leftPos = '';
            this.topPos = '';
            this.mdcFoundationClass = MDCRippleFoundation$1;
        }
        get isActive() {
            return matches(this.parentElement || this, ':active');
        }
        createAdapter() {
            return {
                browserSupportsCssVars: () => true,
                isUnbounded: () => this.unbounded,
                isSurfaceActive: () => this.isActive,
                isSurfaceDisabled: () => this.disabled,
                addClass: (className) => {
                    switch (className) {
                        case 'mdc-ripple-upgraded--background-focused':
                            this.bgFocused = true;
                            break;
                        case 'mdc-ripple-upgraded--foreground-activation':
                            this.fgActivation = true;
                            break;
                        case 'mdc-ripple-upgraded--foreground-deactivation':
                            this.fgDeactivation = true;
                            break;
                    }
                },
                removeClass: (className) => {
                    switch (className) {
                        case 'mdc-ripple-upgraded--background-focused':
                            this.bgFocused = false;
                            break;
                        case 'mdc-ripple-upgraded--foreground-activation':
                            this.fgActivation = false;
                            break;
                        case 'mdc-ripple-upgraded--foreground-deactivation':
                            this.fgDeactivation = false;
                            break;
                    }
                },
                containsEventTarget: () => true,
                registerInteractionHandler: () => undefined,
                deregisterInteractionHandler: () => undefined,
                registerDocumentInteractionHandler: () => undefined,
                deregisterDocumentInteractionHandler: () => undefined,
                registerResizeHandler: () => undefined,
                deregisterResizeHandler: () => undefined,
                updateCssVariable: (varName, value) => {
                    switch (varName) {
                        case '--mdc-ripple-fg-scale':
                            this.fgScale = value;
                            break;
                        case '--mdc-ripple-fg-size':
                            this.fgSize = value;
                            break;
                        case '--mdc-ripple-fg-translate-end':
                            this.translateEnd = value;
                            break;
                        case '--mdc-ripple-fg-translate-start':
                            this.translateStart = value;
                            break;
                        case '--mdc-ripple-left':
                            this.leftPos = value;
                            break;
                        case '--mdc-ripple-top':
                            this.topPos = value;
                            break;
                    }
                },
                computeBoundingRect: () => (this.parentElement || this).getBoundingClientRect(),
                getWindowPageOffset: () => ({ x: window.pageXOffset, y: window.pageYOffset }),
            };
        }
        startPress(ev) {
            this.waitForFoundation(() => {
                this.mdcFoundation.activate(ev);
            });
        }
        endPress() {
            this.waitForFoundation(() => {
                this.mdcFoundation.deactivate();
            });
        }
        startFocus() {
            this.waitForFoundation(() => {
                this.mdcFoundation.handleFocus();
            });
        }
        endFocus() {
            this.waitForFoundation(() => {
                this.mdcFoundation.handleBlur();
            });
        }
        startHover() {
            this.hovering = true;
        }
        endHover() {
            this.hovering = false;
        }
        /**
         * Wait for the MDCFoundation to be created by `firstUpdated`
         */
        waitForFoundation(fn) {
            if (this.mdcFoundation) {
                fn();
            }
            else {
                this.updateComplete.then(fn);
            }
        }
        update(changedProperties) {
            if (changedProperties.has('disabled')) {
                // stop hovering when ripple is disabled to prevent a stuck "hover" state
                // When re-enabled, the outer component will get a `mouseenter` event on
                // the first movement, which will call `startHover()`
                if (this.disabled) {
                    this.endHover();
                }
            }
            super.update(changedProperties);
        }
        /** @soyTemplate */
        render() {
            const shouldActivateInPrimary = this.activated && (this.primary || !this.accent);
            const shouldSelectInPrimary = this.selected && (this.primary || !this.accent);
            /** @classMap */
            const classes = {
                'mdc-ripple-surface--accent': this.accent,
                'mdc-ripple-surface--primary--activated': shouldActivateInPrimary,
                'mdc-ripple-surface--accent--activated': this.accent && this.activated,
                'mdc-ripple-surface--primary--selected': shouldSelectInPrimary,
                'mdc-ripple-surface--accent--selected': this.accent && this.selected,
                'mdc-ripple-surface--disabled': this.disabled,
                'mdc-ripple-surface--hover': this.hovering,
                'mdc-ripple-surface--primary': this.primary,
                'mdc-ripple-surface--selected': this.selected,
                'mdc-ripple-upgraded--background-focused': this.bgFocused,
                'mdc-ripple-upgraded--foreground-activation': this.fgActivation,
                'mdc-ripple-upgraded--foreground-deactivation': this.fgDeactivation,
                'mdc-ripple-upgraded--unbounded': this.unbounded,
                'mdc-ripple-surface--internal-use-state-layer-custom-properties': this.internalUseStateLayerCustomProperties,
            };
            return y `
        <div class="mdc-ripple-surface mdc-ripple-upgraded ${o(classes)}"
          style="${i({
            '--mdc-ripple-fg-scale': this.fgScale,
            '--mdc-ripple-fg-size': this.fgSize,
            '--mdc-ripple-fg-translate-end': this.translateEnd,
            '--mdc-ripple-fg-translate-start': this.translateStart,
            '--mdc-ripple-left': this.leftPos,
            '--mdc-ripple-top': this.topPos,
        })}"></div>`;
        }
    }
    __decorate$4([
        i$4('.mdc-ripple-surface')
    ], RippleBase.prototype, "mdcRoot", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "primary", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "accent", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "unbounded", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "disabled", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "activated", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "selected", void 0);
    __decorate$4([
        e$9({ type: Boolean })
    ], RippleBase.prototype, "internalUseStateLayerCustomProperties", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "hovering", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "bgFocused", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "fgActivation", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "fgDeactivation", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "fgScale", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "fgSize", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "translateStart", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "translateEnd", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "leftPos", void 0);
    __decorate$4([
        t$4()
    ], RippleBase.prototype, "topPos", void 0);

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles$4 = i$2 `.mdc-ripple-surface{--mdc-ripple-fg-size: 0;--mdc-ripple-left: 0;--mdc-ripple-top: 0;--mdc-ripple-fg-scale: 1;--mdc-ripple-fg-translate-end: 0;--mdc-ripple-fg-translate-start: 0;-webkit-tap-highlight-color:rgba(0,0,0,0);will-change:transform,opacity;position:relative;outline:none;overflow:hidden}.mdc-ripple-surface::before,.mdc-ripple-surface::after{position:absolute;border-radius:50%;opacity:0;pointer-events:none;content:""}.mdc-ripple-surface::before{transition:opacity 15ms linear,background-color 15ms linear;z-index:1;z-index:var(--mdc-ripple-z-index, 1)}.mdc-ripple-surface::after{z-index:0;z-index:var(--mdc-ripple-z-index, 0)}.mdc-ripple-surface.mdc-ripple-upgraded::before{transform:scale(var(--mdc-ripple-fg-scale, 1))}.mdc-ripple-surface.mdc-ripple-upgraded::after{top:0;left:0;transform:scale(0);transform-origin:center center}.mdc-ripple-surface.mdc-ripple-upgraded--unbounded::after{top:var(--mdc-ripple-top, 0);left:var(--mdc-ripple-left, 0)}.mdc-ripple-surface.mdc-ripple-upgraded--foreground-activation::after{animation:mdc-ripple-fg-radius-in 225ms forwards,mdc-ripple-fg-opacity-in 75ms forwards}.mdc-ripple-surface.mdc-ripple-upgraded--foreground-deactivation::after{animation:mdc-ripple-fg-opacity-out 150ms;transform:translate(var(--mdc-ripple-fg-translate-end, 0)) scale(var(--mdc-ripple-fg-scale, 1))}.mdc-ripple-surface::before,.mdc-ripple-surface::after{top:calc(50% - 100%);left:calc(50% - 100%);width:200%;height:200%}.mdc-ripple-surface.mdc-ripple-upgraded::after{width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}.mdc-ripple-surface[data-mdc-ripple-is-unbounded],.mdc-ripple-upgraded--unbounded{overflow:visible}.mdc-ripple-surface[data-mdc-ripple-is-unbounded]::before,.mdc-ripple-surface[data-mdc-ripple-is-unbounded]::after,.mdc-ripple-upgraded--unbounded::before,.mdc-ripple-upgraded--unbounded::after{top:calc(50% - 50%);left:calc(50% - 50%);width:100%;height:100%}.mdc-ripple-surface[data-mdc-ripple-is-unbounded].mdc-ripple-upgraded::before,.mdc-ripple-surface[data-mdc-ripple-is-unbounded].mdc-ripple-upgraded::after,.mdc-ripple-upgraded--unbounded.mdc-ripple-upgraded::before,.mdc-ripple-upgraded--unbounded.mdc-ripple-upgraded::after{top:var(--mdc-ripple-top, calc(50% - 50%));left:var(--mdc-ripple-left, calc(50% - 50%));width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}.mdc-ripple-surface[data-mdc-ripple-is-unbounded].mdc-ripple-upgraded::after,.mdc-ripple-upgraded--unbounded.mdc-ripple-upgraded::after{width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}.mdc-ripple-surface::before,.mdc-ripple-surface::after{background-color:#000;background-color:var(--mdc-ripple-color, #000)}.mdc-ripple-surface:hover::before,.mdc-ripple-surface.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-ripple-surface.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-ripple-surface:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.12)}@keyframes mdc-ripple-fg-radius-in{from{animation-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transform:translate(var(--mdc-ripple-fg-translate-start, 0)) scale(1)}to{transform:translate(var(--mdc-ripple-fg-translate-end, 0)) scale(var(--mdc-ripple-fg-scale, 1))}}@keyframes mdc-ripple-fg-opacity-in{from{animation-timing-function:linear;opacity:0}to{opacity:var(--mdc-ripple-fg-opacity, 0)}}@keyframes mdc-ripple-fg-opacity-out{from{animation-timing-function:linear;opacity:var(--mdc-ripple-fg-opacity, 0)}to{opacity:0}}:host{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:block}:host .mdc-ripple-surface{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;will-change:unset}.mdc-ripple-surface--primary::before,.mdc-ripple-surface--primary::after{background-color:#6200ee;background-color:var(--mdc-ripple-color, var(--mdc-theme-primary, #6200ee))}.mdc-ripple-surface--primary:hover::before,.mdc-ripple-surface--primary.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-ripple-surface--primary.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--primary:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-ripple-surface--primary:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--primary:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--primary.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--primary--activated::before{opacity:0.12;opacity:var(--mdc-ripple-activated-opacity, 0.12)}.mdc-ripple-surface--primary--activated::before,.mdc-ripple-surface--primary--activated::after{background-color:#6200ee;background-color:var(--mdc-ripple-color, var(--mdc-theme-primary, #6200ee))}.mdc-ripple-surface--primary--activated:hover::before,.mdc-ripple-surface--primary--activated.mdc-ripple-surface--hover::before{opacity:0.16;opacity:var(--mdc-ripple-hover-opacity, 0.16)}.mdc-ripple-surface--primary--activated.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--primary--activated:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-focus-opacity, 0.24)}.mdc-ripple-surface--primary--activated:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--primary--activated:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--primary--activated.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--primary--selected::before{opacity:0.08;opacity:var(--mdc-ripple-selected-opacity, 0.08)}.mdc-ripple-surface--primary--selected::before,.mdc-ripple-surface--primary--selected::after{background-color:#6200ee;background-color:var(--mdc-ripple-color, var(--mdc-theme-primary, #6200ee))}.mdc-ripple-surface--primary--selected:hover::before,.mdc-ripple-surface--primary--selected.mdc-ripple-surface--hover::before{opacity:0.12;opacity:var(--mdc-ripple-hover-opacity, 0.12)}.mdc-ripple-surface--primary--selected.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--primary--selected:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-focus-opacity, 0.2)}.mdc-ripple-surface--primary--selected:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--primary--selected:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--primary--selected.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--accent::before,.mdc-ripple-surface--accent::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-ripple-surface--accent:hover::before,.mdc-ripple-surface--accent.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-ripple-surface--accent.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--accent:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-ripple-surface--accent:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--accent:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--accent.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.12)}.mdc-ripple-surface--accent--activated::before{opacity:0.12;opacity:var(--mdc-ripple-activated-opacity, 0.12)}.mdc-ripple-surface--accent--activated::before,.mdc-ripple-surface--accent--activated::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-ripple-surface--accent--activated:hover::before,.mdc-ripple-surface--accent--activated.mdc-ripple-surface--hover::before{opacity:0.16;opacity:var(--mdc-ripple-hover-opacity, 0.16)}.mdc-ripple-surface--accent--activated.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--accent--activated:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-focus-opacity, 0.24)}.mdc-ripple-surface--accent--activated:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--accent--activated:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.24;opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--accent--activated.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.24)}.mdc-ripple-surface--accent--selected::before{opacity:0.08;opacity:var(--mdc-ripple-selected-opacity, 0.08)}.mdc-ripple-surface--accent--selected::before,.mdc-ripple-surface--accent--selected::after{background-color:#018786;background-color:var(--mdc-ripple-color, var(--mdc-theme-secondary, #018786))}.mdc-ripple-surface--accent--selected:hover::before,.mdc-ripple-surface--accent--selected.mdc-ripple-surface--hover::before{opacity:0.12;opacity:var(--mdc-ripple-hover-opacity, 0.12)}.mdc-ripple-surface--accent--selected.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--accent--selected:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-focus-opacity, 0.2)}.mdc-ripple-surface--accent--selected:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--accent--selected:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.2;opacity:var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--accent--selected.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-press-opacity, 0.2)}.mdc-ripple-surface--disabled{opacity:0}.mdc-ripple-surface--internal-use-state-layer-custom-properties::before,.mdc-ripple-surface--internal-use-state-layer-custom-properties::after{background-color:#000;background-color:var(--mdc-ripple-hover-state-layer-color, #000)}.mdc-ripple-surface--internal-use-state-layer-custom-properties:hover::before,.mdc-ripple-surface--internal-use-state-layer-custom-properties.mdc-ripple-surface--hover::before{opacity:0.04;opacity:var(--mdc-ripple-hover-state-layer-opacity, 0.04)}.mdc-ripple-surface--internal-use-state-layer-custom-properties.mdc-ripple-upgraded--background-focused::before,.mdc-ripple-surface--internal-use-state-layer-custom-properties:not(.mdc-ripple-upgraded):focus::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-state-layer-opacity, 0.12)}.mdc-ripple-surface--internal-use-state-layer-custom-properties:not(.mdc-ripple-upgraded)::after{transition:opacity 150ms linear}.mdc-ripple-surface--internal-use-state-layer-custom-properties:not(.mdc-ripple-upgraded):active::after{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-pressed-state-layer-opacity, 0.12)}.mdc-ripple-surface--internal-use-state-layer-custom-properties.mdc-ripple-upgraded{--mdc-ripple-fg-opacity:var(--mdc-ripple-pressed-state-layer-opacity, 0.12)}`;

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    let Ripple = class Ripple extends RippleBase {
    };
    Ripple.styles = [styles$4];
    Ripple = __decorate$4([
        e$a('mwc-ripple')
    ], Ripple);

    /**
     * @license
     * Copyright 2020 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /**
     * Class that encapsulates the events handlers for `mwc-ripple`
     *
     *
     * Example:
     * ```
     * class XFoo extends LitElement {
     *   async getRipple() {
     *     this.renderRipple = true;
     *     await this.updateComplete;
     *     return this.renderRoot.querySelector('mwc-ripple');
     *   }
     *   rippleHandlers = new RippleHandlers(() => this.getRipple());
     *
     *   render() {
     *     return html`
     *       <div @mousedown=${this.rippleHandlers.startPress}></div>
     *       ${this.renderRipple ? html`<mwc-ripple></mwc-ripple>` : ''}
     *     `;
     *   }
     * }
     * ```
     */
    class RippleHandlers {
        constructor(
        /** Function that returns a `mwc-ripple` */
        rippleFn) {
            this.startPress = (ev) => {
                rippleFn().then((r) => {
                    r && r.startPress(ev);
                });
            };
            this.endPress = () => {
                rippleFn().then((r) => {
                    r && r.endPress();
                });
            };
            this.startFocus = () => {
                rippleFn().then((r) => {
                    r && r.startFocus();
                });
            };
            this.endFocus = () => {
                rippleFn().then((r) => {
                    r && r.endFocus();
                });
            };
            this.startHover = () => {
                rippleFn().then((r) => {
                    r && r.startHover();
                });
            };
            this.endHover = () => {
                rippleFn().then((r) => {
                    r && r.endHover();
                });
            };
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    class ButtonBase extends s$1 {
        constructor() {
            super(...arguments);
            this.raised = false;
            this.unelevated = false;
            this.outlined = false;
            this.dense = false;
            this.disabled = false;
            this.trailingIcon = false;
            this.fullwidth = false;
            this.icon = '';
            this.label = '';
            this.expandContent = false;
            this.shouldRenderRipple = false;
            this.rippleHandlers = new RippleHandlers(() => {
                this.shouldRenderRipple = true;
                return this.ripple;
            });
        }
        /** @soyTemplate */
        renderOverlay() {
            return y ``;
        }
        /** @soyTemplate */
        renderRipple() {
            const filled = this.raised || this.unelevated;
            return this.shouldRenderRipple ?
                y `<mwc-ripple class="ripple" .primary="${!filled}" .disabled="${this.disabled}"></mwc-ripple>` :
                '';
        }
        focus() {
            const buttonElement = this.buttonElement;
            if (buttonElement) {
                this.rippleHandlers.startFocus();
                buttonElement.focus();
            }
        }
        blur() {
            const buttonElement = this.buttonElement;
            if (buttonElement) {
                this.rippleHandlers.endFocus();
                buttonElement.blur();
            }
        }
        /** @soyTemplate */
        getRenderClasses() {
            return {
                'mdc-button--raised': this.raised,
                'mdc-button--unelevated': this.unelevated,
                'mdc-button--outlined': this.outlined,
                'mdc-button--dense': this.dense,
            };
        }
        /**
         * @soyTemplate
         * @soyAttributes buttonAttributes: #button
         * @soyClasses buttonClasses: #button
         */
        render() {
            return y `
      <button
          id="button"
          class="mdc-button ${o(this.getRenderClasses())}"
          ?disabled="${this.disabled}"
          aria-label="${this.label || this.icon}"
          aria-haspopup="${l$1(this.ariaHasPopup)}"
          @focus="${this.handleRippleFocus}"
          @blur="${this.handleRippleBlur}"
          @mousedown="${this.handleRippleActivate}"
          @mouseenter="${this.handleRippleMouseEnter}"
          @mouseleave="${this.handleRippleMouseLeave}"
          @touchstart="${this.handleRippleActivate}"
          @touchend="${this.handleRippleDeactivate}"
          @touchcancel="${this.handleRippleDeactivate}">
        ${this.renderOverlay()}
        ${this.renderRipple()}
        <span class="leading-icon">
          <slot name="icon">
            ${this.icon && !this.trailingIcon ? this.renderIcon() : ''}
          </slot>
        </span>
        <span class="mdc-button__label">${this.label}</span>
        <span class="slot-container ${o({
            flex: this.expandContent
        })}">
          <slot></slot>
        </span>
        <span class="trailing-icon">
          <slot name="trailingIcon">
            ${this.icon && this.trailingIcon ? this.renderIcon() : ''}
          </slot>
        </span>
      </button>`;
        }
        /** @soyTemplate */
        renderIcon() {
            return y `
    <mwc-icon class="mdc-button__icon">
      ${this.icon}
    </mwc-icon>`;
        }
        handleRippleActivate(evt) {
            const onUp = () => {
                window.removeEventListener('mouseup', onUp);
                this.handleRippleDeactivate();
            };
            window.addEventListener('mouseup', onUp);
            this.rippleHandlers.startPress(evt);
        }
        handleRippleDeactivate() {
            this.rippleHandlers.endPress();
        }
        handleRippleMouseEnter() {
            this.rippleHandlers.startHover();
        }
        handleRippleMouseLeave() {
            this.rippleHandlers.endHover();
        }
        handleRippleFocus() {
            this.rippleHandlers.startFocus();
        }
        handleRippleBlur() {
            this.rippleHandlers.endFocus();
        }
    }
    ButtonBase.shadowRootOptions = { mode: 'open', delegatesFocus: true };
    __decorate$6([
        ariaProperty,
        e$9({ type: String, attribute: 'aria-haspopup' })
    ], ButtonBase.prototype, "ariaHasPopup", void 0);
    __decorate$6([
        e$9({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "raised", void 0);
    __decorate$6([
        e$9({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "unelevated", void 0);
    __decorate$6([
        e$9({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "outlined", void 0);
    __decorate$6([
        e$9({ type: Boolean })
    ], ButtonBase.prototype, "dense", void 0);
    __decorate$6([
        e$9({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "disabled", void 0);
    __decorate$6([
        e$9({ type: Boolean, attribute: 'trailingicon' })
    ], ButtonBase.prototype, "trailingIcon", void 0);
    __decorate$6([
        e$9({ type: Boolean, reflect: true })
    ], ButtonBase.prototype, "fullwidth", void 0);
    __decorate$6([
        e$9({ type: String })
    ], ButtonBase.prototype, "icon", void 0);
    __decorate$6([
        e$9({ type: String })
    ], ButtonBase.prototype, "label", void 0);
    __decorate$6([
        e$9({ type: Boolean })
    ], ButtonBase.prototype, "expandContent", void 0);
    __decorate$6([
        i$4('#button')
    ], ButtonBase.prototype, "buttonElement", void 0);
    __decorate$6([
        e$7('mwc-ripple')
    ], ButtonBase.prototype, "ripple", void 0);
    __decorate$6([
        t$4()
    ], ButtonBase.prototype, "shouldRenderRipple", void 0);
    __decorate$6([
        e$8({ passive: true })
    ], ButtonBase.prototype, "handleRippleActivate", null);

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles$3 = i$2 `.mdc-button{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-button-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.875rem;font-size:var(--mdc-typography-button-font-size, 0.875rem);line-height:2.25rem;line-height:var(--mdc-typography-button-line-height, 2.25rem);font-weight:500;font-weight:var(--mdc-typography-button-font-weight, 500);letter-spacing:0.0892857143em;letter-spacing:var(--mdc-typography-button-letter-spacing, 0.0892857143em);text-decoration:none;text-decoration:var(--mdc-typography-button-text-decoration, none);text-transform:uppercase;text-transform:var(--mdc-typography-button-text-transform, uppercase)}.mdc-touch-target-wrapper{display:inline}.mdc-elevation-overlay{position:absolute;border-radius:inherit;pointer-events:none;opacity:0;opacity:var(--mdc-elevation-overlay-opacity, 0);transition:opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);background-color:#fff;background-color:var(--mdc-elevation-overlay-color, #fff)}.mdc-button{position:relative;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:64px;border:none;outline:none;line-height:inherit;user-select:none;-webkit-appearance:none;overflow:visible;vertical-align:middle;background:transparent}.mdc-button .mdc-elevation-overlay{width:100%;height:100%;top:0;left:0}.mdc-button::-moz-focus-inner{padding:0;border:0}.mdc-button:active{outline:none}.mdc-button:hover{cursor:pointer}.mdc-button:disabled{cursor:default;pointer-events:none}.mdc-button .mdc-button__icon{margin-left:0;margin-right:8px;display:inline-block;position:relative;vertical-align:top}[dir=rtl] .mdc-button .mdc-button__icon,.mdc-button .mdc-button__icon[dir=rtl]{margin-left:8px;margin-right:0}.mdc-button .mdc-button__label{position:relative}.mdc-button .mdc-button__touch{position:absolute;top:50%;height:48px;left:0;right:0;transform:translateY(-50%)}.mdc-button__label+.mdc-button__icon{margin-left:8px;margin-right:0}[dir=rtl] .mdc-button__label+.mdc-button__icon,.mdc-button__label+.mdc-button__icon[dir=rtl]{margin-left:0;margin-right:8px}svg.mdc-button__icon{fill:currentColor}.mdc-button--touch{margin-top:6px;margin-bottom:6px}.mdc-button{padding:0 8px 0 8px}.mdc-button--unelevated{transition:box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);padding:0 16px 0 16px}.mdc-button--unelevated.mdc-button--icon-trailing{padding:0 12px 0 16px}.mdc-button--unelevated.mdc-button--icon-leading{padding:0 16px 0 12px}.mdc-button--raised{transition:box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);padding:0 16px 0 16px}.mdc-button--raised.mdc-button--icon-trailing{padding:0 12px 0 16px}.mdc-button--raised.mdc-button--icon-leading{padding:0 16px 0 12px}.mdc-button--outlined{border-style:solid;transition:border 280ms cubic-bezier(0.4, 0, 0.2, 1)}.mdc-button--outlined .mdc-button__ripple{border-style:solid;border-color:transparent}.mdc-button{height:36px;border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-button:not(:disabled){color:#6200ee;color:var(--mdc-theme-primary, #6200ee)}.mdc-button:disabled{color:rgba(0, 0, 0, 0.38)}.mdc-button .mdc-button__icon{font-size:1.125rem;width:1.125rem;height:1.125rem}.mdc-button .mdc-button__ripple{border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-button--raised,.mdc-button--unelevated{height:36px;border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-button--raised:not(:disabled),.mdc-button--unelevated:not(:disabled){background-color:#6200ee;background-color:var(--mdc-theme-primary, #6200ee)}.mdc-button--raised:disabled,.mdc-button--unelevated:disabled{background-color:rgba(0, 0, 0, 0.12)}.mdc-button--raised:not(:disabled),.mdc-button--unelevated:not(:disabled){color:#fff;color:var(--mdc-theme-on-primary, #fff)}.mdc-button--raised:disabled,.mdc-button--unelevated:disabled{color:rgba(0, 0, 0, 0.38)}.mdc-button--raised .mdc-button__icon,.mdc-button--unelevated .mdc-button__icon{font-size:1.125rem;width:1.125rem;height:1.125rem}.mdc-button--raised .mdc-button__ripple,.mdc-button--unelevated .mdc-button__ripple{border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-button--outlined{height:36px;border-radius:4px;border-radius:var(--mdc-shape-small, 4px);padding:0 15px 0 15px;border-width:1px}.mdc-button--outlined:not(:disabled){color:#6200ee;color:var(--mdc-theme-primary, #6200ee)}.mdc-button--outlined:disabled{color:rgba(0, 0, 0, 0.38)}.mdc-button--outlined .mdc-button__icon{font-size:1.125rem;width:1.125rem;height:1.125rem}.mdc-button--outlined .mdc-button__ripple{border-radius:4px;border-radius:var(--mdc-shape-small, 4px)}.mdc-button--outlined:not(:disabled){border-color:rgba(0, 0, 0, 0.12)}.mdc-button--outlined:disabled{border-color:rgba(0, 0, 0, 0.12)}.mdc-button--outlined.mdc-button--icon-trailing{padding:0 11px 0 15px}.mdc-button--outlined.mdc-button--icon-leading{padding:0 15px 0 11px}.mdc-button--outlined .mdc-button__ripple{top:calc(-1 * 1px);left:calc(-1 * 1px);border-width:1px}.mdc-button--outlined .mdc-button__touch{left:calc(-1 * 1px);width:calc(100% + 2 * 1px)}.mdc-button--raised{box-shadow:0px 3px 1px -2px rgba(0, 0, 0, 0.2),0px 2px 2px 0px rgba(0, 0, 0, 0.14),0px 1px 5px 0px rgba(0,0,0,.12);transition:box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1)}.mdc-button--raised:hover,.mdc-button--raised:focus{box-shadow:0px 2px 4px -1px rgba(0, 0, 0, 0.2),0px 4px 5px 0px rgba(0, 0, 0, 0.14),0px 1px 10px 0px rgba(0,0,0,.12)}.mdc-button--raised:active{box-shadow:0px 5px 5px -3px rgba(0, 0, 0, 0.2),0px 8px 10px 1px rgba(0, 0, 0, 0.14),0px 3px 14px 2px rgba(0,0,0,.12)}.mdc-button--raised:disabled{box-shadow:0px 0px 0px 0px rgba(0, 0, 0, 0.2),0px 0px 0px 0px rgba(0, 0, 0, 0.14),0px 0px 0px 0px rgba(0,0,0,.12)}:host{display:inline-flex;outline:none;-webkit-tap-highlight-color:transparent;vertical-align:top}:host([fullwidth]){width:100%}:host([raised]),:host([unelevated]){--mdc-ripple-color:#fff;--mdc-ripple-focus-opacity:0.24;--mdc-ripple-hover-opacity:0.08;--mdc-ripple-press-opacity:0.24}.trailing-icon ::slotted(*),.trailing-icon .mdc-button__icon,.leading-icon ::slotted(*),.leading-icon .mdc-button__icon{margin-left:0;margin-right:8px;display:inline-block;position:relative;vertical-align:top;font-size:1.125rem;height:1.125rem;width:1.125rem}[dir=rtl] .trailing-icon ::slotted(*),[dir=rtl] .trailing-icon .mdc-button__icon,[dir=rtl] .leading-icon ::slotted(*),[dir=rtl] .leading-icon .mdc-button__icon,.trailing-icon ::slotted(*[dir=rtl]),.trailing-icon .mdc-button__icon[dir=rtl],.leading-icon ::slotted(*[dir=rtl]),.leading-icon .mdc-button__icon[dir=rtl]{margin-left:8px;margin-right:0}.trailing-icon ::slotted(*),.trailing-icon .mdc-button__icon{margin-left:8px;margin-right:0}[dir=rtl] .trailing-icon ::slotted(*),[dir=rtl] .trailing-icon .mdc-button__icon,.trailing-icon ::slotted(*[dir=rtl]),.trailing-icon .mdc-button__icon[dir=rtl]{margin-left:0;margin-right:8px}.slot-container{display:inline-flex;align-items:center;justify-content:center}.slot-container.flex{flex:auto}.mdc-button{flex:auto;overflow:hidden;padding-left:8px;padding-left:var(--mdc-button-horizontal-padding, 8px);padding-right:8px;padding-right:var(--mdc-button-horizontal-padding, 8px)}.mdc-button--raised{box-shadow:0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow, 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12))}.mdc-button--raised:focus{box-shadow:0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-focus, var(--mdc-button-raised-box-shadow-hover, 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)))}.mdc-button--raised:hover{box-shadow:0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-hover, 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12))}.mdc-button--raised:active{box-shadow:0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-active, 0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12))}.mdc-button--raised:disabled{box-shadow:0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12);box-shadow:var(--mdc-button-raised-box-shadow-disabled, 0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12))}.mdc-button--raised,.mdc-button--unelevated{padding-left:16px;padding-left:var(--mdc-button-horizontal-padding, 16px);padding-right:16px;padding-right:var(--mdc-button-horizontal-padding, 16px)}.mdc-button--outlined{border-width:1px;border-width:var(--mdc-button-outline-width, 1px);padding-left:calc(16px - 1px);padding-left:calc(var(--mdc-button-horizontal-padding, 16px) - var(--mdc-button-outline-width, 1px));padding-right:calc(16px - 1px);padding-right:calc(var(--mdc-button-horizontal-padding, 16px) - var(--mdc-button-outline-width, 1px))}.mdc-button--outlined:not(:disabled){border-color:rgba(0, 0, 0, 0.12);border-color:var(--mdc-button-outline-color, rgba(0, 0, 0, 0.12))}.mdc-button--outlined .ripple{top:calc(-1 * 1px);top:calc(-1 * var(--mdc-button-outline-width, 1px));left:calc(-1 * 1px);left:calc(-1 * var(--mdc-button-outline-width, 1px));right:initial;right:initial;border-width:1px;border-width:var(--mdc-button-outline-width, 1px);border-style:solid;border-color:transparent}[dir=rtl] .mdc-button--outlined .ripple,.mdc-button--outlined .ripple[dir=rtl]{left:initial;left:initial;right:calc(-1 * 1px);right:calc(-1 * var(--mdc-button-outline-width, 1px))}.mdc-button--dense{height:28px;margin-top:0;margin-bottom:0}.mdc-button--dense .mdc-button__touch{height:100%}:host([disabled]){pointer-events:none}:host([disabled]) .mdc-button{color:rgba(0, 0, 0, 0.38);color:var(--mdc-button-disabled-ink-color, rgba(0, 0, 0, 0.38))}:host([disabled]) .mdc-button--raised,:host([disabled]) .mdc-button--unelevated{background-color:rgba(0, 0, 0, 0.12);background-color:var(--mdc-button-disabled-fill-color, rgba(0, 0, 0, 0.12))}:host([disabled]) .mdc-button--outlined{border-color:rgba(0, 0, 0, 0.12);border-color:var(--mdc-button-disabled-outline-color, rgba(0, 0, 0, 0.12))}`;

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    let Button = class Button extends ButtonBase {
    };
    Button.styles = [styles$3];
    Button = __decorate$6([
        e$a('mwc-button')
    ], Button);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$3(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles$2 = i$2 `.mdc-floating-label{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-subtitle1-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:1rem;font-size:var(--mdc-typography-subtitle1-font-size, 1rem);font-weight:400;font-weight:var(--mdc-typography-subtitle1-font-weight, 400);letter-spacing:0.009375em;letter-spacing:var(--mdc-typography-subtitle1-letter-spacing, 0.009375em);text-decoration:inherit;text-decoration:var(--mdc-typography-subtitle1-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-subtitle1-text-transform, inherit);position:absolute;left:0;-webkit-transform-origin:left top;transform-origin:left top;line-height:1.15rem;text-align:left;text-overflow:ellipsis;white-space:nowrap;cursor:text;overflow:hidden;will-change:transform;transition:transform 150ms cubic-bezier(0.4, 0, 0.2, 1),color 150ms cubic-bezier(0.4, 0, 0.2, 1)}[dir=rtl] .mdc-floating-label,.mdc-floating-label[dir=rtl]{right:0;left:auto;-webkit-transform-origin:right top;transform-origin:right top;text-align:right}.mdc-floating-label--float-above{cursor:auto}.mdc-floating-label--required::after{margin-left:1px;margin-right:0px;content:"*"}[dir=rtl] .mdc-floating-label--required::after,.mdc-floating-label--required[dir=rtl]::after{margin-left:0;margin-right:1px}.mdc-floating-label--float-above{transform:translateY(-106%) scale(0.75)}.mdc-floating-label--shake{animation:mdc-floating-label-shake-float-above-standard 250ms 1}@keyframes mdc-floating-label-shake-float-above-standard{0%{transform:translateX(calc(0 - 0%)) translateY(-106%) scale(0.75)}33%{animation-timing-function:cubic-bezier(0.5, 0, 0.701732, 0.495819);transform:translateX(calc(4% - 0%)) translateY(-106%) scale(0.75)}66%{animation-timing-function:cubic-bezier(0.302435, 0.381352, 0.55, 0.956352);transform:translateX(calc(-4% - 0%)) translateY(-106%) scale(0.75)}100%{transform:translateX(calc(0 - 0%)) translateY(-106%) scale(0.75)}}.mdc-line-ripple::before,.mdc-line-ripple::after{position:absolute;bottom:0;left:0;width:100%;border-bottom-style:solid;content:""}.mdc-line-ripple::before{border-bottom-width:1px;z-index:1}.mdc-line-ripple::after{transform:scaleX(0);border-bottom-width:2px;opacity:0;z-index:2}.mdc-line-ripple::after{transition:transform 180ms cubic-bezier(0.4, 0, 0.2, 1),opacity 180ms cubic-bezier(0.4, 0, 0.2, 1)}.mdc-line-ripple--active::after{transform:scaleX(1);opacity:1}.mdc-line-ripple--deactivating::after{opacity:0}.mdc-notched-outline{display:flex;position:absolute;top:0;right:0;left:0;box-sizing:border-box;width:100%;max-width:100%;height:100%;text-align:left;pointer-events:none}[dir=rtl] .mdc-notched-outline,.mdc-notched-outline[dir=rtl]{text-align:right}.mdc-notched-outline__leading,.mdc-notched-outline__notch,.mdc-notched-outline__trailing{box-sizing:border-box;height:100%;border-top:1px solid;border-bottom:1px solid;pointer-events:none}.mdc-notched-outline__leading{border-left:1px solid;border-right:none;width:12px}[dir=rtl] .mdc-notched-outline__leading,.mdc-notched-outline__leading[dir=rtl]{border-left:none;border-right:1px solid}.mdc-notched-outline__trailing{border-left:none;border-right:1px solid;flex-grow:1}[dir=rtl] .mdc-notched-outline__trailing,.mdc-notched-outline__trailing[dir=rtl]{border-left:1px solid;border-right:none}.mdc-notched-outline__notch{flex:0 0 auto;width:auto;max-width:calc(100% - 12px * 2)}.mdc-notched-outline .mdc-floating-label{display:inline-block;position:relative;max-width:100%}.mdc-notched-outline .mdc-floating-label--float-above{text-overflow:clip}.mdc-notched-outline--upgraded .mdc-floating-label--float-above{max-width:calc(100% / 0.75)}.mdc-notched-outline--notched .mdc-notched-outline__notch{padding-left:0;padding-right:8px;border-top:none}[dir=rtl] .mdc-notched-outline--notched .mdc-notched-outline__notch,.mdc-notched-outline--notched .mdc-notched-outline__notch[dir=rtl]{padding-left:8px;padding-right:0}.mdc-notched-outline--no-label .mdc-notched-outline__notch{display:none}@keyframes mdc-ripple-fg-radius-in{from{animation-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transform:translate(var(--mdc-ripple-fg-translate-start, 0)) scale(1)}to{transform:translate(var(--mdc-ripple-fg-translate-end, 0)) scale(var(--mdc-ripple-fg-scale, 1))}}@keyframes mdc-ripple-fg-opacity-in{from{animation-timing-function:linear;opacity:0}to{opacity:var(--mdc-ripple-fg-opacity, 0)}}@keyframes mdc-ripple-fg-opacity-out{from{animation-timing-function:linear;opacity:var(--mdc-ripple-fg-opacity, 0)}to{opacity:0}}.mdc-text-field--filled{--mdc-ripple-fg-size: 0;--mdc-ripple-left: 0;--mdc-ripple-top: 0;--mdc-ripple-fg-scale: 1;--mdc-ripple-fg-translate-end: 0;--mdc-ripple-fg-translate-start: 0;-webkit-tap-highlight-color:rgba(0,0,0,0);will-change:transform,opacity}.mdc-text-field--filled .mdc-text-field__ripple::before,.mdc-text-field--filled .mdc-text-field__ripple::after{position:absolute;border-radius:50%;opacity:0;pointer-events:none;content:""}.mdc-text-field--filled .mdc-text-field__ripple::before{transition:opacity 15ms linear,background-color 15ms linear;z-index:1;z-index:var(--mdc-ripple-z-index, 1)}.mdc-text-field--filled .mdc-text-field__ripple::after{z-index:0;z-index:var(--mdc-ripple-z-index, 0)}.mdc-text-field--filled.mdc-ripple-upgraded .mdc-text-field__ripple::before{transform:scale(var(--mdc-ripple-fg-scale, 1))}.mdc-text-field--filled.mdc-ripple-upgraded .mdc-text-field__ripple::after{top:0;left:0;transform:scale(0);transform-origin:center center}.mdc-text-field--filled.mdc-ripple-upgraded--unbounded .mdc-text-field__ripple::after{top:var(--mdc-ripple-top, 0);left:var(--mdc-ripple-left, 0)}.mdc-text-field--filled.mdc-ripple-upgraded--foreground-activation .mdc-text-field__ripple::after{animation:mdc-ripple-fg-radius-in 225ms forwards,mdc-ripple-fg-opacity-in 75ms forwards}.mdc-text-field--filled.mdc-ripple-upgraded--foreground-deactivation .mdc-text-field__ripple::after{animation:mdc-ripple-fg-opacity-out 150ms;transform:translate(var(--mdc-ripple-fg-translate-end, 0)) scale(var(--mdc-ripple-fg-scale, 1))}.mdc-text-field--filled .mdc-text-field__ripple::before,.mdc-text-field--filled .mdc-text-field__ripple::after{top:calc(50% - 100%);left:calc(50% - 100%);width:200%;height:200%}.mdc-text-field--filled.mdc-ripple-upgraded .mdc-text-field__ripple::after{width:var(--mdc-ripple-fg-size, 100%);height:var(--mdc-ripple-fg-size, 100%)}.mdc-text-field__ripple{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}.mdc-text-field{border-top-left-radius:4px;border-top-left-radius:var(--mdc-shape-small, 4px);border-top-right-radius:4px;border-top-right-radius:var(--mdc-shape-small, 4px);border-bottom-right-radius:0;border-bottom-left-radius:0;display:inline-flex;align-items:baseline;padding:0 16px;position:relative;box-sizing:border-box;overflow:hidden;will-change:opacity,transform,color}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-floating-label{color:rgba(0, 0, 0, 0.6)}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__input{color:rgba(0, 0, 0, 0.87)}@media all{.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__input::placeholder{color:rgba(0, 0, 0, 0.54)}}@media all{.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__input:-ms-input-placeholder{color:rgba(0, 0, 0, 0.54)}}.mdc-text-field .mdc-text-field__input{caret-color:#6200ee;caret-color:var(--mdc-theme-primary, #6200ee)}.mdc-text-field:not(.mdc-text-field--disabled)+.mdc-text-field-helper-line .mdc-text-field-helper-text{color:rgba(0, 0, 0, 0.6)}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field-character-counter,.mdc-text-field:not(.mdc-text-field--disabled)+.mdc-text-field-helper-line .mdc-text-field-character-counter{color:rgba(0, 0, 0, 0.6)}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__icon--leading{color:rgba(0, 0, 0, 0.54)}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__icon--trailing{color:rgba(0, 0, 0, 0.54)}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__affix--prefix{color:rgba(0, 0, 0, 0.6)}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-text-field__affix--suffix{color:rgba(0, 0, 0, 0.6)}.mdc-text-field .mdc-floating-label{top:50%;transform:translateY(-50%);pointer-events:none}.mdc-text-field__input{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-subtitle1-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:1rem;font-size:var(--mdc-typography-subtitle1-font-size, 1rem);font-weight:400;font-weight:var(--mdc-typography-subtitle1-font-weight, 400);letter-spacing:0.009375em;letter-spacing:var(--mdc-typography-subtitle1-letter-spacing, 0.009375em);text-decoration:inherit;text-decoration:var(--mdc-typography-subtitle1-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-subtitle1-text-transform, inherit);height:28px;transition:opacity 150ms 0ms cubic-bezier(0.4, 0, 0.2, 1);width:100%;min-width:0;border:none;border-radius:0;background:none;appearance:none;padding:0}.mdc-text-field__input::-ms-clear{display:none}.mdc-text-field__input::-webkit-calendar-picker-indicator{display:none}.mdc-text-field__input:focus{outline:none}.mdc-text-field__input:invalid{box-shadow:none}@media all{.mdc-text-field__input::placeholder{transition:opacity 67ms 0ms cubic-bezier(0.4, 0, 0.2, 1);opacity:0}}@media all{.mdc-text-field__input:-ms-input-placeholder{transition:opacity 67ms 0ms cubic-bezier(0.4, 0, 0.2, 1);opacity:0}}@media all{.mdc-text-field--no-label .mdc-text-field__input::placeholder,.mdc-text-field--focused .mdc-text-field__input::placeholder{transition-delay:40ms;transition-duration:110ms;opacity:1}}@media all{.mdc-text-field--no-label .mdc-text-field__input:-ms-input-placeholder,.mdc-text-field--focused .mdc-text-field__input:-ms-input-placeholder{transition-delay:40ms;transition-duration:110ms;opacity:1}}.mdc-text-field__affix{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-subtitle1-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:1rem;font-size:var(--mdc-typography-subtitle1-font-size, 1rem);font-weight:400;font-weight:var(--mdc-typography-subtitle1-font-weight, 400);letter-spacing:0.009375em;letter-spacing:var(--mdc-typography-subtitle1-letter-spacing, 0.009375em);text-decoration:inherit;text-decoration:var(--mdc-typography-subtitle1-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-subtitle1-text-transform, inherit);height:28px;transition:opacity 150ms 0ms cubic-bezier(0.4, 0, 0.2, 1);opacity:0;white-space:nowrap}.mdc-text-field--label-floating .mdc-text-field__affix,.mdc-text-field--no-label .mdc-text-field__affix{opacity:1}@supports(-webkit-hyphens: none){.mdc-text-field--outlined .mdc-text-field__affix{align-items:center;align-self:center;display:inline-flex;height:100%}}.mdc-text-field__affix--prefix{padding-left:0;padding-right:2px}[dir=rtl] .mdc-text-field__affix--prefix,.mdc-text-field__affix--prefix[dir=rtl]{padding-left:2px;padding-right:0}.mdc-text-field--end-aligned .mdc-text-field__affix--prefix{padding-left:0;padding-right:12px}[dir=rtl] .mdc-text-field--end-aligned .mdc-text-field__affix--prefix,.mdc-text-field--end-aligned .mdc-text-field__affix--prefix[dir=rtl]{padding-left:12px;padding-right:0}.mdc-text-field__affix--suffix{padding-left:12px;padding-right:0}[dir=rtl] .mdc-text-field__affix--suffix,.mdc-text-field__affix--suffix[dir=rtl]{padding-left:0;padding-right:12px}.mdc-text-field--end-aligned .mdc-text-field__affix--suffix{padding-left:2px;padding-right:0}[dir=rtl] .mdc-text-field--end-aligned .mdc-text-field__affix--suffix,.mdc-text-field--end-aligned .mdc-text-field__affix--suffix[dir=rtl]{padding-left:0;padding-right:2px}.mdc-text-field--filled{height:56px}.mdc-text-field--filled .mdc-text-field__ripple::before,.mdc-text-field--filled .mdc-text-field__ripple::after{background-color:rgba(0, 0, 0, 0.87);background-color:var(--mdc-ripple-color, rgba(0, 0, 0, 0.87))}.mdc-text-field--filled:hover .mdc-text-field__ripple::before,.mdc-text-field--filled.mdc-ripple-surface--hover .mdc-text-field__ripple::before{opacity:0.04;opacity:var(--mdc-ripple-hover-opacity, 0.04)}.mdc-text-field--filled.mdc-ripple-upgraded--background-focused .mdc-text-field__ripple::before,.mdc-text-field--filled:not(.mdc-ripple-upgraded):focus .mdc-text-field__ripple::before{transition-duration:75ms;opacity:0.12;opacity:var(--mdc-ripple-focus-opacity, 0.12)}.mdc-text-field--filled::before{display:inline-block;width:0;height:40px;content:"";vertical-align:0}.mdc-text-field--filled:not(.mdc-text-field--disabled){background-color:whitesmoke}.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-line-ripple::before{border-bottom-color:rgba(0, 0, 0, 0.42)}.mdc-text-field--filled:not(.mdc-text-field--disabled):hover .mdc-line-ripple::before{border-bottom-color:rgba(0, 0, 0, 0.87)}.mdc-text-field--filled .mdc-line-ripple::after{border-bottom-color:#6200ee;border-bottom-color:var(--mdc-theme-primary, #6200ee)}.mdc-text-field--filled .mdc-floating-label{left:16px;right:initial}[dir=rtl] .mdc-text-field--filled .mdc-floating-label,.mdc-text-field--filled .mdc-floating-label[dir=rtl]{left:initial;right:16px}.mdc-text-field--filled .mdc-floating-label--float-above{transform:translateY(-106%) scale(0.75)}.mdc-text-field--filled.mdc-text-field--no-label .mdc-text-field__input{height:100%}.mdc-text-field--filled.mdc-text-field--no-label .mdc-floating-label{display:none}.mdc-text-field--filled.mdc-text-field--no-label::before{display:none}@supports(-webkit-hyphens: none){.mdc-text-field--filled.mdc-text-field--no-label .mdc-text-field__affix{align-items:center;align-self:center;display:inline-flex;height:100%}}.mdc-text-field--outlined{height:56px;overflow:visible}.mdc-text-field--outlined .mdc-floating-label--float-above{transform:translateY(-37.25px) scale(1)}.mdc-text-field--outlined .mdc-floating-label--float-above{font-size:.75rem}.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above{transform:translateY(-34.75px) scale(0.75)}.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above{font-size:1rem}.mdc-text-field--outlined .mdc-floating-label--shake{animation:mdc-floating-label-shake-float-above-text-field-outlined 250ms 1}@keyframes mdc-floating-label-shake-float-above-text-field-outlined{0%{transform:translateX(calc(0 - 0%)) translateY(-34.75px) scale(0.75)}33%{animation-timing-function:cubic-bezier(0.5, 0, 0.701732, 0.495819);transform:translateX(calc(4% - 0%)) translateY(-34.75px) scale(0.75)}66%{animation-timing-function:cubic-bezier(0.302435, 0.381352, 0.55, 0.956352);transform:translateX(calc(-4% - 0%)) translateY(-34.75px) scale(0.75)}100%{transform:translateX(calc(0 - 0%)) translateY(-34.75px) scale(0.75)}}.mdc-text-field--outlined .mdc-text-field__input{height:100%}.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__leading,.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__notch,.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__trailing{border-color:rgba(0, 0, 0, 0.38)}.mdc-text-field--outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-notched-outline .mdc-notched-outline__leading,.mdc-text-field--outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-notched-outline .mdc-notched-outline__notch,.mdc-text-field--outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-notched-outline .mdc-notched-outline__trailing{border-color:rgba(0, 0, 0, 0.87)}.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline__leading,.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline__notch,.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline__trailing{border-color:#6200ee;border-color:var(--mdc-theme-primary, #6200ee)}.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading{border-top-left-radius:4px;border-top-left-radius:var(--mdc-shape-small, 4px);border-top-right-radius:0;border-bottom-right-radius:0;border-bottom-left-radius:4px;border-bottom-left-radius:var(--mdc-shape-small, 4px)}[dir=rtl] .mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading,.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading[dir=rtl]{border-top-left-radius:0;border-top-right-radius:4px;border-top-right-radius:var(--mdc-shape-small, 4px);border-bottom-right-radius:4px;border-bottom-right-radius:var(--mdc-shape-small, 4px);border-bottom-left-radius:0}@supports(top: max(0%)){.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading{width:max(12px, var(--mdc-shape-small, 4px))}}@supports(top: max(0%)){.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__notch{max-width:calc(100% - max(12px, var(--mdc-shape-small, 4px)) * 2)}}.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__trailing{border-top-left-radius:0;border-top-right-radius:4px;border-top-right-radius:var(--mdc-shape-small, 4px);border-bottom-right-radius:4px;border-bottom-right-radius:var(--mdc-shape-small, 4px);border-bottom-left-radius:0}[dir=rtl] .mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__trailing,.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__trailing[dir=rtl]{border-top-left-radius:4px;border-top-left-radius:var(--mdc-shape-small, 4px);border-top-right-radius:0;border-bottom-right-radius:0;border-bottom-left-radius:4px;border-bottom-left-radius:var(--mdc-shape-small, 4px)}@supports(top: max(0%)){.mdc-text-field--outlined{padding-left:max(16px, calc(var(--mdc-shape-small, 4px) + 4px))}}@supports(top: max(0%)){.mdc-text-field--outlined{padding-right:max(16px, var(--mdc-shape-small, 4px))}}@supports(top: max(0%)){.mdc-text-field--outlined+.mdc-text-field-helper-line{padding-left:max(16px, calc(var(--mdc-shape-small, 4px) + 4px))}}@supports(top: max(0%)){.mdc-text-field--outlined+.mdc-text-field-helper-line{padding-right:max(16px, var(--mdc-shape-small, 4px))}}.mdc-text-field--outlined.mdc-text-field--with-leading-icon{padding-left:0}@supports(top: max(0%)){.mdc-text-field--outlined.mdc-text-field--with-leading-icon{padding-right:max(16px, var(--mdc-shape-small, 4px))}}[dir=rtl] .mdc-text-field--outlined.mdc-text-field--with-leading-icon,.mdc-text-field--outlined.mdc-text-field--with-leading-icon[dir=rtl]{padding-right:0}@supports(top: max(0%)){[dir=rtl] .mdc-text-field--outlined.mdc-text-field--with-leading-icon,.mdc-text-field--outlined.mdc-text-field--with-leading-icon[dir=rtl]{padding-left:max(16px, var(--mdc-shape-small, 4px))}}.mdc-text-field--outlined.mdc-text-field--with-trailing-icon{padding-right:0}@supports(top: max(0%)){.mdc-text-field--outlined.mdc-text-field--with-trailing-icon{padding-left:max(16px, calc(var(--mdc-shape-small, 4px) + 4px))}}[dir=rtl] .mdc-text-field--outlined.mdc-text-field--with-trailing-icon,.mdc-text-field--outlined.mdc-text-field--with-trailing-icon[dir=rtl]{padding-left:0}@supports(top: max(0%)){[dir=rtl] .mdc-text-field--outlined.mdc-text-field--with-trailing-icon,.mdc-text-field--outlined.mdc-text-field--with-trailing-icon[dir=rtl]{padding-right:max(16px, calc(var(--mdc-shape-small, 4px) + 4px))}}.mdc-text-field--outlined.mdc-text-field--with-leading-icon.mdc-text-field--with-trailing-icon{padding-left:0;padding-right:0}.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch{padding-top:1px}.mdc-text-field--outlined .mdc-text-field__ripple::before,.mdc-text-field--outlined .mdc-text-field__ripple::after{content:none}.mdc-text-field--outlined .mdc-floating-label{left:4px;right:initial}[dir=rtl] .mdc-text-field--outlined .mdc-floating-label,.mdc-text-field--outlined .mdc-floating-label[dir=rtl]{left:initial;right:4px}.mdc-text-field--outlined .mdc-text-field__input{display:flex;border:none !important;background-color:transparent}.mdc-text-field--outlined .mdc-notched-outline{z-index:1}.mdc-text-field--textarea{flex-direction:column;align-items:center;width:auto;height:auto;padding:0;transition:none}.mdc-text-field--textarea .mdc-floating-label{top:19px}.mdc-text-field--textarea .mdc-floating-label:not(.mdc-floating-label--float-above){transform:none}.mdc-text-field--textarea .mdc-text-field__input{flex-grow:1;height:auto;min-height:1.5rem;overflow-x:hidden;overflow-y:auto;box-sizing:border-box;resize:none;padding:0 16px;line-height:1.5rem}.mdc-text-field--textarea.mdc-text-field--filled::before{display:none}.mdc-text-field--textarea.mdc-text-field--filled .mdc-floating-label--float-above{transform:translateY(-10.25px) scale(0.75)}.mdc-text-field--textarea.mdc-text-field--filled .mdc-floating-label--shake{animation:mdc-floating-label-shake-float-above-textarea-filled 250ms 1}@keyframes mdc-floating-label-shake-float-above-textarea-filled{0%{transform:translateX(calc(0 - 0%)) translateY(-10.25px) scale(0.75)}33%{animation-timing-function:cubic-bezier(0.5, 0, 0.701732, 0.495819);transform:translateX(calc(4% - 0%)) translateY(-10.25px) scale(0.75)}66%{animation-timing-function:cubic-bezier(0.302435, 0.381352, 0.55, 0.956352);transform:translateX(calc(-4% - 0%)) translateY(-10.25px) scale(0.75)}100%{transform:translateX(calc(0 - 0%)) translateY(-10.25px) scale(0.75)}}.mdc-text-field--textarea.mdc-text-field--filled .mdc-text-field__input{margin-top:23px;margin-bottom:9px}.mdc-text-field--textarea.mdc-text-field--filled.mdc-text-field--no-label .mdc-text-field__input{margin-top:16px;margin-bottom:16px}.mdc-text-field--textarea.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch{padding-top:0}.mdc-text-field--textarea.mdc-text-field--outlined .mdc-floating-label--float-above{transform:translateY(-27.25px) scale(1)}.mdc-text-field--textarea.mdc-text-field--outlined .mdc-floating-label--float-above{font-size:.75rem}.mdc-text-field--textarea.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--textarea.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above{transform:translateY(-24.75px) scale(0.75)}.mdc-text-field--textarea.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--textarea.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above{font-size:1rem}.mdc-text-field--textarea.mdc-text-field--outlined .mdc-floating-label--shake{animation:mdc-floating-label-shake-float-above-textarea-outlined 250ms 1}@keyframes mdc-floating-label-shake-float-above-textarea-outlined{0%{transform:translateX(calc(0 - 0%)) translateY(-24.75px) scale(0.75)}33%{animation-timing-function:cubic-bezier(0.5, 0, 0.701732, 0.495819);transform:translateX(calc(4% - 0%)) translateY(-24.75px) scale(0.75)}66%{animation-timing-function:cubic-bezier(0.302435, 0.381352, 0.55, 0.956352);transform:translateX(calc(-4% - 0%)) translateY(-24.75px) scale(0.75)}100%{transform:translateX(calc(0 - 0%)) translateY(-24.75px) scale(0.75)}}.mdc-text-field--textarea.mdc-text-field--outlined .mdc-text-field__input{margin-top:16px;margin-bottom:16px}.mdc-text-field--textarea.mdc-text-field--outlined .mdc-floating-label{top:18px}.mdc-text-field--textarea.mdc-text-field--with-internal-counter .mdc-text-field__input{margin-bottom:2px}.mdc-text-field--textarea.mdc-text-field--with-internal-counter .mdc-text-field-character-counter{align-self:flex-end;padding:0 16px}.mdc-text-field--textarea.mdc-text-field--with-internal-counter .mdc-text-field-character-counter::after{display:inline-block;width:0;height:16px;content:"";vertical-align:-16px}.mdc-text-field--textarea.mdc-text-field--with-internal-counter .mdc-text-field-character-counter::before{display:none}.mdc-text-field__resizer{align-self:stretch;display:inline-flex;flex-direction:column;flex-grow:1;max-height:100%;max-width:100%;min-height:56px;min-width:fit-content;min-width:-moz-available;min-width:-webkit-fill-available;overflow:hidden;resize:both}.mdc-text-field--filled .mdc-text-field__resizer{transform:translateY(-1px)}.mdc-text-field--filled .mdc-text-field__resizer .mdc-text-field__input,.mdc-text-field--filled .mdc-text-field__resizer .mdc-text-field-character-counter{transform:translateY(1px)}.mdc-text-field--outlined .mdc-text-field__resizer{transform:translateX(-1px) translateY(-1px)}[dir=rtl] .mdc-text-field--outlined .mdc-text-field__resizer,.mdc-text-field--outlined .mdc-text-field__resizer[dir=rtl]{transform:translateX(1px) translateY(-1px)}.mdc-text-field--outlined .mdc-text-field__resizer .mdc-text-field__input,.mdc-text-field--outlined .mdc-text-field__resizer .mdc-text-field-character-counter{transform:translateX(1px) translateY(1px)}[dir=rtl] .mdc-text-field--outlined .mdc-text-field__resizer .mdc-text-field__input,[dir=rtl] .mdc-text-field--outlined .mdc-text-field__resizer .mdc-text-field-character-counter,.mdc-text-field--outlined .mdc-text-field__resizer .mdc-text-field__input[dir=rtl],.mdc-text-field--outlined .mdc-text-field__resizer .mdc-text-field-character-counter[dir=rtl]{transform:translateX(-1px) translateY(1px)}.mdc-text-field--with-leading-icon{padding-left:0;padding-right:16px}[dir=rtl] .mdc-text-field--with-leading-icon,.mdc-text-field--with-leading-icon[dir=rtl]{padding-left:16px;padding-right:0}.mdc-text-field--with-leading-icon.mdc-text-field--filled .mdc-floating-label{max-width:calc(100% - 48px);left:48px;right:initial}[dir=rtl] .mdc-text-field--with-leading-icon.mdc-text-field--filled .mdc-floating-label,.mdc-text-field--with-leading-icon.mdc-text-field--filled .mdc-floating-label[dir=rtl]{left:initial;right:48px}.mdc-text-field--with-leading-icon.mdc-text-field--filled .mdc-floating-label--float-above{max-width:calc(100% / 0.75 - 64px / 0.75)}.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label{left:36px;right:initial}[dir=rtl] .mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label,.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label[dir=rtl]{left:initial;right:36px}.mdc-text-field--with-leading-icon.mdc-text-field--outlined :not(.mdc-notched-outline--notched) .mdc-notched-outline__notch{max-width:calc(100% - 60px)}.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label--float-above{transform:translateY(-37.25px) translateX(-32px) scale(1)}[dir=rtl] .mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label--float-above,.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label--float-above[dir=rtl]{transform:translateY(-37.25px) translateX(32px) scale(1)}.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label--float-above{font-size:.75rem}.mdc-text-field--with-leading-icon.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above{transform:translateY(-34.75px) translateX(-32px) scale(0.75)}[dir=rtl] .mdc-text-field--with-leading-icon.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,[dir=rtl] .mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--with-leading-icon.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above[dir=rtl],.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above[dir=rtl]{transform:translateY(-34.75px) translateX(32px) scale(0.75)}.mdc-text-field--with-leading-icon.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above,.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above{font-size:1rem}.mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label--shake{animation:mdc-floating-label-shake-float-above-text-field-outlined-leading-icon 250ms 1}@keyframes mdc-floating-label-shake-float-above-text-field-outlined-leading-icon{0%{transform:translateX(calc(0 - 32px)) translateY(-34.75px) scale(0.75)}33%{animation-timing-function:cubic-bezier(0.5, 0, 0.701732, 0.495819);transform:translateX(calc(4% - 32px)) translateY(-34.75px) scale(0.75)}66%{animation-timing-function:cubic-bezier(0.302435, 0.381352, 0.55, 0.956352);transform:translateX(calc(-4% - 32px)) translateY(-34.75px) scale(0.75)}100%{transform:translateX(calc(0 - 32px)) translateY(-34.75px) scale(0.75)}}[dir=rtl] .mdc-text-field--with-leading-icon.mdc-text-field--outlined .mdc-floating-label--shake,.mdc-text-field--with-leading-icon.mdc-text-field--outlined[dir=rtl] .mdc-floating-label--shake{animation:mdc-floating-label-shake-float-above-text-field-outlined-leading-icon 250ms 1}@keyframes mdc-floating-label-shake-float-above-text-field-outlined-leading-icon-rtl{0%{transform:translateX(calc(0 - -32px)) translateY(-34.75px) scale(0.75)}33%{animation-timing-function:cubic-bezier(0.5, 0, 0.701732, 0.495819);transform:translateX(calc(4% - -32px)) translateY(-34.75px) scale(0.75)}66%{animation-timing-function:cubic-bezier(0.302435, 0.381352, 0.55, 0.956352);transform:translateX(calc(-4% - -32px)) translateY(-34.75px) scale(0.75)}100%{transform:translateX(calc(0 - -32px)) translateY(-34.75px) scale(0.75)}}.mdc-text-field--with-trailing-icon{padding-left:16px;padding-right:0}[dir=rtl] .mdc-text-field--with-trailing-icon,.mdc-text-field--with-trailing-icon[dir=rtl]{padding-left:0;padding-right:16px}.mdc-text-field--with-trailing-icon.mdc-text-field--filled .mdc-floating-label{max-width:calc(100% - 64px)}.mdc-text-field--with-trailing-icon.mdc-text-field--filled .mdc-floating-label--float-above{max-width:calc(100% / 0.75 - 64px / 0.75)}.mdc-text-field--with-trailing-icon.mdc-text-field--outlined :not(.mdc-notched-outline--notched) .mdc-notched-outline__notch{max-width:calc(100% - 60px)}.mdc-text-field--with-leading-icon.mdc-text-field--with-trailing-icon{padding-left:0;padding-right:0}.mdc-text-field--with-leading-icon.mdc-text-field--with-trailing-icon.mdc-text-field--filled .mdc-floating-label{max-width:calc(100% - 96px)}.mdc-text-field--with-leading-icon.mdc-text-field--with-trailing-icon.mdc-text-field--filled .mdc-floating-label--float-above{max-width:calc(100% / 0.75 - 96px / 0.75)}.mdc-text-field-helper-line{display:flex;justify-content:space-between;box-sizing:border-box}.mdc-text-field+.mdc-text-field-helper-line{padding-right:16px;padding-left:16px}.mdc-form-field>.mdc-text-field+label{align-self:flex-start}.mdc-text-field--focused:not(.mdc-text-field--disabled) .mdc-floating-label{color:rgba(98, 0, 238, 0.87)}.mdc-text-field--focused .mdc-notched-outline__leading,.mdc-text-field--focused .mdc-notched-outline__notch,.mdc-text-field--focused .mdc-notched-outline__trailing{border-width:2px}.mdc-text-field--focused+.mdc-text-field-helper-line .mdc-text-field-helper-text:not(.mdc-text-field-helper-text--validation-msg){opacity:1}.mdc-text-field--focused.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch{padding-top:2px}.mdc-text-field--focused.mdc-text-field--outlined.mdc-text-field--textarea .mdc-notched-outline--notched .mdc-notched-outline__notch{padding-top:0}.mdc-text-field--invalid:not(.mdc-text-field--disabled):hover .mdc-line-ripple::before{border-bottom-color:#b00020;border-bottom-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-line-ripple::after{border-bottom-color:#b00020;border-bottom-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-floating-label{color:#b00020;color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled).mdc-text-field--invalid+.mdc-text-field-helper-line .mdc-text-field-helper-text--validation-msg{color:#b00020;color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid .mdc-text-field__input{caret-color:#b00020;caret-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-text-field__icon--trailing{color:#b00020;color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-line-ripple::before{border-bottom-color:#b00020;border-bottom-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-notched-outline__leading,.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-notched-outline__notch,.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-notched-outline__trailing{border-color:#b00020;border-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-notched-outline .mdc-notched-outline__leading,.mdc-text-field--invalid:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-notched-outline .mdc-notched-outline__notch,.mdc-text-field--invalid:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-notched-outline .mdc-notched-outline__trailing{border-color:#b00020;border-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline__leading,.mdc-text-field--invalid:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline__notch,.mdc-text-field--invalid:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline__trailing{border-color:#b00020;border-color:var(--mdc-theme-error, #b00020)}.mdc-text-field--invalid+.mdc-text-field-helper-line .mdc-text-field-helper-text--validation-msg{opacity:1}.mdc-text-field--disabled{pointer-events:none}.mdc-text-field--disabled .mdc-text-field__input{color:rgba(0, 0, 0, 0.38)}@media all{.mdc-text-field--disabled .mdc-text-field__input::placeholder{color:rgba(0, 0, 0, 0.38)}}@media all{.mdc-text-field--disabled .mdc-text-field__input:-ms-input-placeholder{color:rgba(0, 0, 0, 0.38)}}.mdc-text-field--disabled .mdc-floating-label{color:rgba(0, 0, 0, 0.38)}.mdc-text-field--disabled+.mdc-text-field-helper-line .mdc-text-field-helper-text{color:rgba(0, 0, 0, 0.38)}.mdc-text-field--disabled .mdc-text-field-character-counter,.mdc-text-field--disabled+.mdc-text-field-helper-line .mdc-text-field-character-counter{color:rgba(0, 0, 0, 0.38)}.mdc-text-field--disabled .mdc-text-field__icon--leading{color:rgba(0, 0, 0, 0.3)}.mdc-text-field--disabled .mdc-text-field__icon--trailing{color:rgba(0, 0, 0, 0.3)}.mdc-text-field--disabled .mdc-text-field__affix--prefix{color:rgba(0, 0, 0, 0.38)}.mdc-text-field--disabled .mdc-text-field__affix--suffix{color:rgba(0, 0, 0, 0.38)}.mdc-text-field--disabled .mdc-line-ripple::before{border-bottom-color:rgba(0, 0, 0, 0.06)}.mdc-text-field--disabled .mdc-notched-outline__leading,.mdc-text-field--disabled .mdc-notched-outline__notch,.mdc-text-field--disabled .mdc-notched-outline__trailing{border-color:rgba(0, 0, 0, 0.06)}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field__input::placeholder{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field__input:-ms-input-placeholder{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-floating-label{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled+.mdc-text-field-helper-line .mdc-text-field-helper-text{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field-character-counter,.mdc-text-field--disabled+.mdc-text-field-helper-line .mdc-text-field-character-counter{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field__icon--leading{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field__icon--trailing{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field__affix--prefix{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-text-field__affix--suffix{color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-line-ripple::before{border-bottom-color:GrayText}}@media screen and (forced-colors: active),(-ms-high-contrast: active){.mdc-text-field--disabled .mdc-notched-outline__leading,.mdc-text-field--disabled .mdc-notched-outline__notch,.mdc-text-field--disabled .mdc-notched-outline__trailing{border-color:GrayText}}@media screen and (forced-colors: active){.mdc-text-field--disabled .mdc-text-field__input{background-color:Window}.mdc-text-field--disabled .mdc-floating-label{z-index:1}}.mdc-text-field--disabled .mdc-floating-label{cursor:default}.mdc-text-field--disabled.mdc-text-field--filled{background-color:#fafafa}.mdc-text-field--disabled.mdc-text-field--filled .mdc-text-field__ripple{display:none}.mdc-text-field--disabled .mdc-text-field__input{pointer-events:auto}.mdc-text-field--end-aligned .mdc-text-field__input{text-align:right}[dir=rtl] .mdc-text-field--end-aligned .mdc-text-field__input,.mdc-text-field--end-aligned .mdc-text-field__input[dir=rtl]{text-align:left}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__input,[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__affix,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__input,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__affix{direction:ltr}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__affix--prefix,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__affix--prefix{padding-left:0;padding-right:2px}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__affix--suffix,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__affix--suffix{padding-left:12px;padding-right:0}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__icon--leading,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__icon--leading{order:1}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__affix--suffix,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__affix--suffix{order:2}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__input,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__input{order:3}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__affix--prefix,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__affix--prefix{order:4}[dir=rtl] .mdc-text-field--ltr-text .mdc-text-field__icon--trailing,.mdc-text-field--ltr-text[dir=rtl] .mdc-text-field__icon--trailing{order:5}[dir=rtl] .mdc-text-field--ltr-text.mdc-text-field--end-aligned .mdc-text-field__input,.mdc-text-field--ltr-text.mdc-text-field--end-aligned[dir=rtl] .mdc-text-field__input{text-align:right}[dir=rtl] .mdc-text-field--ltr-text.mdc-text-field--end-aligned .mdc-text-field__affix--prefix,.mdc-text-field--ltr-text.mdc-text-field--end-aligned[dir=rtl] .mdc-text-field__affix--prefix{padding-right:12px}[dir=rtl] .mdc-text-field--ltr-text.mdc-text-field--end-aligned .mdc-text-field__affix--suffix,.mdc-text-field--ltr-text.mdc-text-field--end-aligned[dir=rtl] .mdc-text-field__affix--suffix{padding-left:2px}.mdc-text-field-helper-text{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-caption-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.75rem;font-size:var(--mdc-typography-caption-font-size, 0.75rem);line-height:1.25rem;line-height:var(--mdc-typography-caption-line-height, 1.25rem);font-weight:400;font-weight:var(--mdc-typography-caption-font-weight, 400);letter-spacing:0.0333333333em;letter-spacing:var(--mdc-typography-caption-letter-spacing, 0.0333333333em);text-decoration:inherit;text-decoration:var(--mdc-typography-caption-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-caption-text-transform, inherit);display:block;margin-top:0;line-height:normal;margin:0;opacity:0;will-change:opacity;transition:opacity 150ms 0ms cubic-bezier(0.4, 0, 0.2, 1)}.mdc-text-field-helper-text::before{display:inline-block;width:0;height:16px;content:"";vertical-align:0}.mdc-text-field-helper-text--persistent{transition:none;opacity:1;will-change:initial}.mdc-text-field-character-counter{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;font-family:Roboto, sans-serif;font-family:var(--mdc-typography-caption-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));font-size:0.75rem;font-size:var(--mdc-typography-caption-font-size, 0.75rem);line-height:1.25rem;line-height:var(--mdc-typography-caption-line-height, 1.25rem);font-weight:400;font-weight:var(--mdc-typography-caption-font-weight, 400);letter-spacing:0.0333333333em;letter-spacing:var(--mdc-typography-caption-letter-spacing, 0.0333333333em);text-decoration:inherit;text-decoration:var(--mdc-typography-caption-text-decoration, inherit);text-transform:inherit;text-transform:var(--mdc-typography-caption-text-transform, inherit);display:block;margin-top:0;line-height:normal;margin-left:auto;margin-right:0;padding-left:16px;padding-right:0;white-space:nowrap}.mdc-text-field-character-counter::before{display:inline-block;width:0;height:16px;content:"";vertical-align:0}[dir=rtl] .mdc-text-field-character-counter,.mdc-text-field-character-counter[dir=rtl]{margin-left:0;margin-right:auto}[dir=rtl] .mdc-text-field-character-counter,.mdc-text-field-character-counter[dir=rtl]{padding-left:0;padding-right:16px}.mdc-text-field__icon{align-self:center;cursor:pointer}.mdc-text-field__icon:not([tabindex]),.mdc-text-field__icon[tabindex="-1"]{cursor:default;pointer-events:none}.mdc-text-field__icon svg{display:block}.mdc-text-field__icon--leading{margin-left:16px;margin-right:8px}[dir=rtl] .mdc-text-field__icon--leading,.mdc-text-field__icon--leading[dir=rtl]{margin-left:8px;margin-right:16px}.mdc-text-field__icon--trailing{padding:12px;margin-left:0px;margin-right:0px}[dir=rtl] .mdc-text-field__icon--trailing,.mdc-text-field__icon--trailing[dir=rtl]{margin-left:0px;margin-right:0px}.material-icons{font-family:var(--mdc-icon-font, "Material Icons");font-weight:normal;font-style:normal;font-size:var(--mdc-icon-size, 24px);line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;font-feature-settings:"liga"}:host{display:inline-flex;flex-direction:column;outline:none}.mdc-text-field{width:100%}.mdc-text-field:not(.mdc-text-field--disabled) .mdc-line-ripple::before{border-bottom-color:rgba(0, 0, 0, 0.42);border-bottom-color:var(--mdc-text-field-idle-line-color, rgba(0, 0, 0, 0.42))}.mdc-text-field:not(.mdc-text-field--disabled):hover .mdc-line-ripple::before{border-bottom-color:rgba(0, 0, 0, 0.87);border-bottom-color:var(--mdc-text-field-hover-line-color, rgba(0, 0, 0, 0.87))}.mdc-text-field.mdc-text-field--disabled .mdc-line-ripple::before{border-bottom-color:rgba(0, 0, 0, 0.06);border-bottom-color:var(--mdc-text-field-disabled-line-color, rgba(0, 0, 0, 0.06))}.mdc-text-field.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-line-ripple::before{border-bottom-color:#b00020;border-bottom-color:var(--mdc-theme-error, #b00020)}.mdc-text-field__input{direction:inherit}mwc-notched-outline{--mdc-notched-outline-border-color: var( --mdc-text-field-outlined-idle-border-color, rgba(0, 0, 0, 0.38) )}:host(:not([disabled]):hover) :not(.mdc-text-field--invalid):not(.mdc-text-field--focused) mwc-notched-outline{--mdc-notched-outline-border-color: var( --mdc-text-field-outlined-hover-border-color, rgba(0, 0, 0, 0.87) )}:host(:not([disabled])) .mdc-text-field:not(.mdc-text-field--outlined){background-color:var(--mdc-text-field-fill-color, whitesmoke)}:host(:not([disabled])) .mdc-text-field.mdc-text-field--invalid mwc-notched-outline{--mdc-notched-outline-border-color: var( --mdc-text-field-error-color, var(--mdc-theme-error, #b00020) )}:host(:not([disabled])) .mdc-text-field.mdc-text-field--invalid+.mdc-text-field-helper-line .mdc-text-field-character-counter,:host(:not([disabled])) .mdc-text-field.mdc-text-field--invalid .mdc-text-field__icon{color:var(--mdc-text-field-error-color, var(--mdc-theme-error, #b00020))}:host(:not([disabled])) .mdc-text-field:not(.mdc-text-field--invalid):not(.mdc-text-field--focused) .mdc-floating-label,:host(:not([disabled])) .mdc-text-field:not(.mdc-text-field--invalid):not(.mdc-text-field--focused) .mdc-floating-label::after{color:var(--mdc-text-field-label-ink-color, rgba(0, 0, 0, 0.6))}:host(:not([disabled])) .mdc-text-field.mdc-text-field--focused mwc-notched-outline{--mdc-notched-outline-stroke-width: 2px}:host(:not([disabled])) .mdc-text-field.mdc-text-field--focused:not(.mdc-text-field--invalid) mwc-notched-outline{--mdc-notched-outline-border-color: var( --mdc-text-field-focused-label-color, var(--mdc-theme-primary, rgba(98, 0, 238, 0.87)) )}:host(:not([disabled])) .mdc-text-field.mdc-text-field--focused:not(.mdc-text-field--invalid) .mdc-floating-label{color:#6200ee;color:var(--mdc-theme-primary, #6200ee)}:host(:not([disabled])) .mdc-text-field .mdc-text-field__input{color:var(--mdc-text-field-ink-color, rgba(0, 0, 0, 0.87))}:host(:not([disabled])) .mdc-text-field .mdc-text-field__input::placeholder{color:var(--mdc-text-field-label-ink-color, rgba(0, 0, 0, 0.6))}:host(:not([disabled])) .mdc-text-field-helper-line .mdc-text-field-helper-text:not(.mdc-text-field-helper-text--validation-msg),:host(:not([disabled])) .mdc-text-field-helper-line:not(.mdc-text-field--invalid) .mdc-text-field-character-counter{color:var(--mdc-text-field-label-ink-color, rgba(0, 0, 0, 0.6))}:host([disabled]) .mdc-text-field:not(.mdc-text-field--outlined){background-color:var(--mdc-text-field-disabled-fill-color, #fafafa)}:host([disabled]) .mdc-text-field.mdc-text-field--outlined mwc-notched-outline{--mdc-notched-outline-border-color: var( --mdc-text-field-outlined-disabled-border-color, rgba(0, 0, 0, 0.06) )}:host([disabled]) .mdc-text-field:not(.mdc-text-field--invalid):not(.mdc-text-field--focused) .mdc-floating-label,:host([disabled]) .mdc-text-field:not(.mdc-text-field--invalid):not(.mdc-text-field--focused) .mdc-floating-label::after{color:var(--mdc-text-field-disabled-ink-color, rgba(0, 0, 0, 0.38))}:host([disabled]) .mdc-text-field .mdc-text-field__input,:host([disabled]) .mdc-text-field .mdc-text-field__input::placeholder{color:var(--mdc-text-field-disabled-ink-color, rgba(0, 0, 0, 0.38))}:host([disabled]) .mdc-text-field-helper-line .mdc-text-field-helper-text,:host([disabled]) .mdc-text-field-helper-line .mdc-text-field-character-counter{color:var(--mdc-text-field-disabled-ink-color, rgba(0, 0, 0, 0.38))}`;

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$2(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$1(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$3 = function(d, b) {
        extendStatics$3 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics$3(d, b);
    };

    function __extends$3(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics$3(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$3 = function() {
        __assign$3 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$3.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var strings$1 = {
        NOTCH_ELEMENT_SELECTOR: '.mdc-notched-outline__notch',
    };
    var numbers$1 = {
        // This should stay in sync with $mdc-notched-outline-padding * 2.
        NOTCH_ELEMENT_PADDING: 8,
    };
    var cssClasses$3 = {
        NO_LABEL: 'mdc-notched-outline--no-label',
        OUTLINE_NOTCHED: 'mdc-notched-outline--notched',
        OUTLINE_UPGRADED: 'mdc-notched-outline--upgraded',
    };

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCNotchedOutlineFoundation = /** @class */ (function (_super) {
        __extends$3(MDCNotchedOutlineFoundation, _super);
        function MDCNotchedOutlineFoundation(adapter) {
            return _super.call(this, __assign$3(__assign$3({}, MDCNotchedOutlineFoundation.defaultAdapter), adapter)) || this;
        }
        Object.defineProperty(MDCNotchedOutlineFoundation, "strings", {
            get: function () {
                return strings$1;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCNotchedOutlineFoundation, "cssClasses", {
            get: function () {
                return cssClasses$3;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCNotchedOutlineFoundation, "numbers", {
            get: function () {
                return numbers$1;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCNotchedOutlineFoundation, "defaultAdapter", {
            /**
             * See {@link MDCNotchedOutlineAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    setNotchWidthProperty: function () { return undefined; },
                    removeNotchWidthProperty: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Adds the outline notched selector and updates the notch width calculated based off of notchWidth.
         */
        MDCNotchedOutlineFoundation.prototype.notch = function (notchWidth) {
            var OUTLINE_NOTCHED = MDCNotchedOutlineFoundation.cssClasses.OUTLINE_NOTCHED;
            if (notchWidth > 0) {
                notchWidth += numbers$1.NOTCH_ELEMENT_PADDING; // Add padding from left/right.
            }
            this.adapter.setNotchWidthProperty(notchWidth);
            this.adapter.addClass(OUTLINE_NOTCHED);
        };
        /**
         * Removes notched outline selector to close the notch in the outline.
         */
        MDCNotchedOutlineFoundation.prototype.closeNotch = function () {
            var OUTLINE_NOTCHED = MDCNotchedOutlineFoundation.cssClasses.OUTLINE_NOTCHED;
            this.adapter.removeClass(OUTLINE_NOTCHED);
            this.adapter.removeNotchWidthProperty();
        };
        return MDCNotchedOutlineFoundation;
    }(MDCFoundation));

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    class NotchedOutlineBase extends BaseElement {
        constructor() {
            super(...arguments);
            this.mdcFoundationClass = MDCNotchedOutlineFoundation;
            this.width = 0;
            this.open = false;
            this.lastOpen = this.open;
        }
        createAdapter() {
            return {
                addClass: (className) => this.mdcRoot.classList.add(className),
                removeClass: (className) => this.mdcRoot.classList.remove(className),
                setNotchWidthProperty: (width) => this.notchElement.style.setProperty('width', `${width}px`),
                removeNotchWidthProperty: () => this.notchElement.style.removeProperty('width'),
            };
        }
        openOrClose(shouldOpen, width) {
            if (!this.mdcFoundation) {
                return;
            }
            if (shouldOpen && width !== undefined) {
                this.mdcFoundation.notch(width);
            }
            else {
                this.mdcFoundation.closeNotch();
            }
        }
        render() {
            this.openOrClose(this.open, this.width);
            const classes = o({
                'mdc-notched-outline--notched': this.open,
            });
            return y `
      <span class="mdc-notched-outline ${classes}">
        <span class="mdc-notched-outline__leading"></span>
        <span class="mdc-notched-outline__notch">
          <slot></slot>
        </span>
        <span class="mdc-notched-outline__trailing"></span>
      </span>`;
        }
    }
    __decorate$1([
        i$4('.mdc-notched-outline')
    ], NotchedOutlineBase.prototype, "mdcRoot", void 0);
    __decorate$1([
        e$9({ type: Number })
    ], NotchedOutlineBase.prototype, "width", void 0);
    __decorate$1([
        e$9({ type: Boolean, reflect: true })
    ], NotchedOutlineBase.prototype, "open", void 0);
    __decorate$1([
        i$4('.mdc-notched-outline__notch')
    ], NotchedOutlineBase.prototype, "notchElement", void 0);

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles$1 = i$2 `.mdc-notched-outline{display:flex;position:absolute;top:0;right:0;left:0;box-sizing:border-box;width:100%;max-width:100%;height:100%;text-align:left;pointer-events:none}[dir=rtl] .mdc-notched-outline,.mdc-notched-outline[dir=rtl]{text-align:right}.mdc-notched-outline__leading,.mdc-notched-outline__notch,.mdc-notched-outline__trailing{box-sizing:border-box;height:100%;border-top:1px solid;border-bottom:1px solid;pointer-events:none}.mdc-notched-outline__leading{border-left:1px solid;border-right:none;width:12px}[dir=rtl] .mdc-notched-outline__leading,.mdc-notched-outline__leading[dir=rtl]{border-left:none;border-right:1px solid}.mdc-notched-outline__trailing{border-left:none;border-right:1px solid;flex-grow:1}[dir=rtl] .mdc-notched-outline__trailing,.mdc-notched-outline__trailing[dir=rtl]{border-left:1px solid;border-right:none}.mdc-notched-outline__notch{flex:0 0 auto;width:auto;max-width:calc(100% - 12px * 2)}.mdc-notched-outline .mdc-floating-label{display:inline-block;position:relative;max-width:100%}.mdc-notched-outline .mdc-floating-label--float-above{text-overflow:clip}.mdc-notched-outline--upgraded .mdc-floating-label--float-above{max-width:calc(100% / 0.75)}.mdc-notched-outline--notched .mdc-notched-outline__notch{padding-left:0;padding-right:8px;border-top:none}[dir=rtl] .mdc-notched-outline--notched .mdc-notched-outline__notch,.mdc-notched-outline--notched .mdc-notched-outline__notch[dir=rtl]{padding-left:8px;padding-right:0}.mdc-notched-outline--no-label .mdc-notched-outline__notch{display:none}:host{display:block;position:absolute;right:0;left:0;box-sizing:border-box;width:100%;max-width:100%;height:100%;text-align:left;pointer-events:none}[dir=rtl] :host,:host([dir=rtl]){text-align:right}::slotted(.mdc-floating-label){display:inline-block;position:relative;top:17px;bottom:auto;max-width:100%}::slotted(.mdc-floating-label--float-above){text-overflow:clip}.mdc-notched-outline--upgraded ::slotted(.mdc-floating-label--float-above){max-width:calc(100% / 0.75)}.mdc-notched-outline .mdc-notched-outline__leading{border-top-left-radius:4px;border-top-left-radius:var(--mdc-shape-small, 4px);border-top-right-radius:0;border-bottom-right-radius:0;border-bottom-left-radius:4px;border-bottom-left-radius:var(--mdc-shape-small, 4px)}[dir=rtl] .mdc-notched-outline .mdc-notched-outline__leading,.mdc-notched-outline .mdc-notched-outline__leading[dir=rtl]{border-top-left-radius:0;border-top-right-radius:4px;border-top-right-radius:var(--mdc-shape-small, 4px);border-bottom-right-radius:4px;border-bottom-right-radius:var(--mdc-shape-small, 4px);border-bottom-left-radius:0}@supports(top: max(0%)){.mdc-notched-outline .mdc-notched-outline__leading{width:max(12px, var(--mdc-shape-small, 4px))}}@supports(top: max(0%)){.mdc-notched-outline .mdc-notched-outline__notch{max-width:calc(100% - max(12px, var(--mdc-shape-small, 4px)) * 2)}}.mdc-notched-outline .mdc-notched-outline__trailing{border-top-left-radius:0;border-top-right-radius:4px;border-top-right-radius:var(--mdc-shape-small, 4px);border-bottom-right-radius:4px;border-bottom-right-radius:var(--mdc-shape-small, 4px);border-bottom-left-radius:0}[dir=rtl] .mdc-notched-outline .mdc-notched-outline__trailing,.mdc-notched-outline .mdc-notched-outline__trailing[dir=rtl]{border-top-left-radius:4px;border-top-left-radius:var(--mdc-shape-small, 4px);border-top-right-radius:0;border-bottom-right-radius:0;border-bottom-left-radius:4px;border-bottom-left-radius:var(--mdc-shape-small, 4px)}.mdc-notched-outline__leading,.mdc-notched-outline__notch,.mdc-notched-outline__trailing{border-color:var(--mdc-notched-outline-border-color, var(--mdc-theme-primary, #6200ee));border-width:1px;border-width:var(--mdc-notched-outline-stroke-width, 1px)}.mdc-notched-outline--notched .mdc-notched-outline__notch{padding-top:0;padding-top:var(--mdc-notched-outline-notch-offset, 0)}`;

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    let NotchedOutline = class NotchedOutline extends NotchedOutlineBase {
    };
    NotchedOutline.styles = [styles$1];
    NotchedOutline = __decorate$1([
        e$a('mwc-notched-outline')
    ], NotchedOutline);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    var _a, _b;
    // ShadyDOM should submit <input> elements in component internals
    const USING_SHADY_DOM = (_b = (_a = window.ShadyDOM) === null || _a === void 0 ? void 0 : _a.inUse) !== null && _b !== void 0 ? _b : false;
    /** @soyCompatible */
    class FormElement extends BaseElement {
        constructor() {
            super(...arguments);
            /**
             * Disabled state for the component. When `disabled` is set to `true`, the
             * component will not be added to form submission.
             */
            this.disabled = false;
            /**
             * Form element that contains this element
             */
            this.containingForm = null;
            this.formDataListener = (ev) => {
                if (!this.disabled) {
                    this.setFormData(ev.formData);
                }
            };
        }
        findFormElement() {
            // If the component internals are not in Shadow DOM, subscribing to form
            // data events could lead to duplicated data, which may not work correctly
            // on the server side.
            if (!this.shadowRoot || USING_SHADY_DOM) {
                return null;
            }
            const root = this.getRootNode();
            const forms = root.querySelectorAll('form');
            for (const form of Array.from(forms)) {
                if (form.contains(this)) {
                    return form;
                }
            }
            return null;
        }
        connectedCallback() {
            var _a;
            super.connectedCallback();
            this.containingForm = this.findFormElement();
            (_a = this.containingForm) === null || _a === void 0 ? void 0 : _a.addEventListener('formdata', this.formDataListener);
        }
        disconnectedCallback() {
            var _a;
            super.disconnectedCallback();
            (_a = this.containingForm) === null || _a === void 0 ? void 0 : _a.removeEventListener('formdata', this.formDataListener);
            this.containingForm = null;
        }
        click() {
            if (this.formElement && !this.disabled) {
                this.formElement.focus();
                this.formElement.click();
            }
        }
        firstUpdated() {
            super.firstUpdated();
            if (this.shadowRoot) {
                this.mdcRoot.addEventListener('change', (e) => {
                    this.dispatchEvent(new Event('change', e));
                });
            }
        }
    }
    FormElement.shadowRootOptions = { mode: 'open', delegatesFocus: true };
    __decorate([
        e$9({ type: Boolean })
    ], FormElement.prototype, "disabled", void 0);

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /**
     * Specifies an observer callback that is run when the decorated property
     * changes. The observer receives the current and old value as arguments.
     */
    const observer = (observer) => 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (proto, propName) => {
        // if we haven't wrapped `updated` in this class, do so
        if (!proto.constructor
            ._observers) {
            proto.constructor._observers = new Map();
            const userUpdated = proto.updated;
            proto.updated = function (changedProperties) {
                userUpdated.call(this, changedProperties);
                changedProperties.forEach((v, k) => {
                    const observers = this.constructor
                        ._observers;
                    const observer = observers.get(k);
                    if (observer !== undefined) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        observer.call(this, this[k], v);
                    }
                });
            };
            // clone any existing observers (superclasses)
            // eslint-disable-next-line no-prototype-builtins
        }
        else if (!proto.constructor.hasOwnProperty('_observers')) {
            const observers = proto.constructor._observers;
            proto.constructor._observers = new Map();
            observers.forEach(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (v, k) => proto.constructor._observers.set(k, v));
        }
        // set this method
        proto.constructor._observers.set(propName, observer);
    };

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$2 = function(d, b) {
        extendStatics$2 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics$2(d, b);
    };

    function __extends$2(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics$2(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$2 = function() {
        __assign$2 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$2.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$2 = {
        LABEL_FLOAT_ABOVE: 'mdc-floating-label--float-above',
        LABEL_REQUIRED: 'mdc-floating-label--required',
        LABEL_SHAKE: 'mdc-floating-label--shake',
        ROOT: 'mdc-floating-label',
    };

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFloatingLabelFoundation = /** @class */ (function (_super) {
        __extends$2(MDCFloatingLabelFoundation, _super);
        function MDCFloatingLabelFoundation(adapter) {
            var _this = _super.call(this, __assign$2(__assign$2({}, MDCFloatingLabelFoundation.defaultAdapter), adapter)) || this;
            _this.shakeAnimationEndHandler = function () {
                _this.handleShakeAnimationEnd();
            };
            return _this;
        }
        Object.defineProperty(MDCFloatingLabelFoundation, "cssClasses", {
            get: function () {
                return cssClasses$2;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCFloatingLabelFoundation, "defaultAdapter", {
            /**
             * See {@link MDCFloatingLabelAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    getWidth: function () { return 0; },
                    registerInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: false,
            configurable: true
        });
        MDCFloatingLabelFoundation.prototype.init = function () {
            this.adapter.registerInteractionHandler('animationend', this.shakeAnimationEndHandler);
        };
        MDCFloatingLabelFoundation.prototype.destroy = function () {
            this.adapter.deregisterInteractionHandler('animationend', this.shakeAnimationEndHandler);
        };
        /**
         * Returns the width of the label element.
         */
        MDCFloatingLabelFoundation.prototype.getWidth = function () {
            return this.adapter.getWidth();
        };
        /**
         * Styles the label to produce a shake animation to indicate an error.
         * @param shouldShake If true, adds the shake CSS class; otherwise, removes shake class.
         */
        MDCFloatingLabelFoundation.prototype.shake = function (shouldShake) {
            var LABEL_SHAKE = MDCFloatingLabelFoundation.cssClasses.LABEL_SHAKE;
            if (shouldShake) {
                this.adapter.addClass(LABEL_SHAKE);
            }
            else {
                this.adapter.removeClass(LABEL_SHAKE);
            }
        };
        /**
         * Styles the label to float or dock.
         * @param shouldFloat If true, adds the float CSS class; otherwise, removes float and shake classes to dock the label.
         */
        MDCFloatingLabelFoundation.prototype.float = function (shouldFloat) {
            var _a = MDCFloatingLabelFoundation.cssClasses, LABEL_FLOAT_ABOVE = _a.LABEL_FLOAT_ABOVE, LABEL_SHAKE = _a.LABEL_SHAKE;
            if (shouldFloat) {
                this.adapter.addClass(LABEL_FLOAT_ABOVE);
            }
            else {
                this.adapter.removeClass(LABEL_FLOAT_ABOVE);
                this.adapter.removeClass(LABEL_SHAKE);
            }
        };
        /**
         * Styles the label as required.
         * @param isRequired If true, adds an asterisk to the label, indicating that it is required.
         */
        MDCFloatingLabelFoundation.prototype.setRequired = function (isRequired) {
            var LABEL_REQUIRED = MDCFloatingLabelFoundation.cssClasses.LABEL_REQUIRED;
            if (isRequired) {
                this.adapter.addClass(LABEL_REQUIRED);
            }
            else {
                this.adapter.removeClass(LABEL_REQUIRED);
            }
        };
        MDCFloatingLabelFoundation.prototype.handleShakeAnimationEnd = function () {
            var LABEL_SHAKE = MDCFloatingLabelFoundation.cssClasses.LABEL_SHAKE;
            this.adapter.removeClass(LABEL_SHAKE);
        };
        return MDCFloatingLabelFoundation;
    }(MDCFoundation));

    /**
     * @license
     * Copyright 2018 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    const createAdapter$1 = (labelElement) => {
        return {
            addClass: (className) => labelElement.classList.add(className),
            removeClass: (className) => labelElement.classList.remove(className),
            getWidth: () => labelElement.scrollWidth,
            registerInteractionHandler: (evtType, handler) => {
                labelElement.addEventListener(evtType, handler);
            },
            deregisterInteractionHandler: (evtType, handler) => {
                labelElement.removeEventListener(evtType, handler);
            },
        };
    };
    class FloatingLabelDirective extends i$1 {
        constructor(partInfo) {
            super(partInfo);
            this.foundation = null;
            this.previousPart = null;
            switch (partInfo.type) {
                // Only allow Attribute and Part bindings
                case t.ATTRIBUTE:
                case t.PROPERTY:
                    break;
                default:
                    throw new Error('FloatingLabel directive only support attribute and property parts');
            }
        }
        /**
         * There is no PropertyPart in Lit 2 so far. For more info see:
         * https://github.com/lit/lit/issues/1863
         */
        update(part, [label]) {
            if (part !== this.previousPart) {
                if (this.foundation) {
                    this.foundation.destroy();
                }
                this.previousPart = part;
                const labelElement = part.element;
                labelElement.classList.add('mdc-floating-label');
                const adapter = createAdapter$1(labelElement);
                this.foundation = new MDCFloatingLabelFoundation(adapter);
                this.foundation.init();
            }
            return this.render(label);
        }
        render(_label) {
            return this.foundation;
        }
    }
    const floatingLabel = e$1(FloatingLabelDirective);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$1 = function(d, b) {
        extendStatics$1 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics$1(d, b);
    };

    function __extends$1(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics$1(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$1 = function() {
        __assign$1 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$1.apply(this, arguments);
    };

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$1 = {
        LINE_RIPPLE_ACTIVE: 'mdc-line-ripple--active',
        LINE_RIPPLE_DEACTIVATING: 'mdc-line-ripple--deactivating',
    };

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCLineRippleFoundation = /** @class */ (function (_super) {
        __extends$1(MDCLineRippleFoundation, _super);
        function MDCLineRippleFoundation(adapter) {
            var _this = _super.call(this, __assign$1(__assign$1({}, MDCLineRippleFoundation.defaultAdapter), adapter)) || this;
            _this.transitionEndHandler = function (evt) {
                _this.handleTransitionEnd(evt);
            };
            return _this;
        }
        Object.defineProperty(MDCLineRippleFoundation, "cssClasses", {
            get: function () {
                return cssClasses$1;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCLineRippleFoundation, "defaultAdapter", {
            /**
             * See {@link MDCLineRippleAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    setStyle: function () { return undefined; },
                    registerEventHandler: function () { return undefined; },
                    deregisterEventHandler: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: false,
            configurable: true
        });
        MDCLineRippleFoundation.prototype.init = function () {
            this.adapter.registerEventHandler('transitionend', this.transitionEndHandler);
        };
        MDCLineRippleFoundation.prototype.destroy = function () {
            this.adapter.deregisterEventHandler('transitionend', this.transitionEndHandler);
        };
        MDCLineRippleFoundation.prototype.activate = function () {
            this.adapter.removeClass(cssClasses$1.LINE_RIPPLE_DEACTIVATING);
            this.adapter.addClass(cssClasses$1.LINE_RIPPLE_ACTIVE);
        };
        MDCLineRippleFoundation.prototype.setRippleCenter = function (xCoordinate) {
            this.adapter.setStyle('transform-origin', xCoordinate + "px center");
        };
        MDCLineRippleFoundation.prototype.deactivate = function () {
            this.adapter.addClass(cssClasses$1.LINE_RIPPLE_DEACTIVATING);
        };
        MDCLineRippleFoundation.prototype.handleTransitionEnd = function (evt) {
            // Wait for the line ripple to be either transparent or opaque
            // before emitting the animation end event
            var isDeactivating = this.adapter.hasClass(cssClasses$1.LINE_RIPPLE_DEACTIVATING);
            if (evt.propertyName === 'opacity') {
                if (isDeactivating) {
                    this.adapter.removeClass(cssClasses$1.LINE_RIPPLE_ACTIVE);
                    this.adapter.removeClass(cssClasses$1.LINE_RIPPLE_DEACTIVATING);
                }
            }
        };
        return MDCLineRippleFoundation;
    }(MDCFoundation));

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    const createAdapter = (lineElement) => {
        return {
            addClass: (className) => lineElement.classList.add(className),
            removeClass: (className) => lineElement.classList.remove(className),
            hasClass: (className) => lineElement.classList.contains(className),
            setStyle: (propertyName, value) => lineElement.style.setProperty(propertyName, value),
            registerEventHandler: (evtType, handler) => {
                lineElement.addEventListener(evtType, handler);
            },
            deregisterEventHandler: (evtType, handler) => {
                lineElement.removeEventListener(evtType, handler);
            },
        };
    };
    class LineRippleDirective extends i$1 {
        constructor(partInfo) {
            super(partInfo);
            this.previousPart = null;
            this.foundation = null;
            switch (partInfo.type) {
                case t.ATTRIBUTE:
                case t.PROPERTY:
                    return;
                default:
                    throw new Error('LineRipple only support attribute and property parts.');
            }
        }
        /**
         * There is no PropertyPart in Lit 2 so far. For more info see:
         * https://github.com/lit/lit/issues/1863
         */
        update(part, _params) {
            if (this.previousPart !== part) {
                if (this.foundation) {
                    this.foundation.destroy();
                }
                this.previousPart = part;
                const lineElement = part.element;
                lineElement.classList.add('mdc-line-ripple');
                const adapter = createAdapter(lineElement);
                this.foundation = new MDCLineRippleFoundation(adapter);
                this.foundation.init();
            }
            return this.render();
        }
        render() {
            return this.foundation;
        }
    }
    const lineRipple = e$1(LineRippleDirective);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __values$1(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var strings = {
        ARIA_CONTROLS: 'aria-controls',
        ARIA_DESCRIBEDBY: 'aria-describedby',
        INPUT_SELECTOR: '.mdc-text-field__input',
        LABEL_SELECTOR: '.mdc-floating-label',
        LEADING_ICON_SELECTOR: '.mdc-text-field__icon--leading',
        LINE_RIPPLE_SELECTOR: '.mdc-line-ripple',
        OUTLINE_SELECTOR: '.mdc-notched-outline',
        PREFIX_SELECTOR: '.mdc-text-field__affix--prefix',
        SUFFIX_SELECTOR: '.mdc-text-field__affix--suffix',
        TRAILING_ICON_SELECTOR: '.mdc-text-field__icon--trailing'
    };
    var cssClasses = {
        DISABLED: 'mdc-text-field--disabled',
        FOCUSED: 'mdc-text-field--focused',
        HELPER_LINE: 'mdc-text-field-helper-line',
        INVALID: 'mdc-text-field--invalid',
        LABEL_FLOATING: 'mdc-text-field--label-floating',
        NO_LABEL: 'mdc-text-field--no-label',
        OUTLINED: 'mdc-text-field--outlined',
        ROOT: 'mdc-text-field',
        TEXTAREA: 'mdc-text-field--textarea',
        WITH_LEADING_ICON: 'mdc-text-field--with-leading-icon',
        WITH_TRAILING_ICON: 'mdc-text-field--with-trailing-icon',
        WITH_INTERNAL_COUNTER: 'mdc-text-field--with-internal-counter',
    };
    var numbers = {
        LABEL_SCALE: 0.75,
    };
    /**
     * Whitelist based off of
     * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/Constraint_validation
     * under the "Validation-related attributes" section.
     */
    var VALIDATION_ATTR_WHITELIST = [
        'pattern',
        'min',
        'max',
        'required',
        'step',
        'minlength',
        'maxlength',
    ];
    /**
     * Label should always float for these types as they show some UI even if value
     * is empty.
     */
    var ALWAYS_FLOAT_TYPES = [
        'color',
        'date',
        'datetime-local',
        'month',
        'range',
        'time',
        'week',
    ];

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var POINTERDOWN_EVENTS = ['mousedown', 'touchstart'];
    var INTERACTION_EVENTS = ['click', 'keydown'];
    var MDCTextFieldFoundation = /** @class */ (function (_super) {
        __extends(MDCTextFieldFoundation, _super);
        /**
         * @param adapter
         * @param foundationMap Map from subcomponent names to their subfoundations.
         */
        function MDCTextFieldFoundation(adapter, foundationMap) {
            if (foundationMap === void 0) { foundationMap = {}; }
            var _this = _super.call(this, __assign(__assign({}, MDCTextFieldFoundation.defaultAdapter), adapter)) || this;
            _this.isFocused = false;
            _this.receivedUserInput = false;
            _this.valid = true;
            _this.useNativeValidation = true;
            _this.validateOnValueChange = true;
            _this.helperText = foundationMap.helperText;
            _this.characterCounter = foundationMap.characterCounter;
            _this.leadingIcon = foundationMap.leadingIcon;
            _this.trailingIcon = foundationMap.trailingIcon;
            _this.inputFocusHandler = function () {
                _this.activateFocus();
            };
            _this.inputBlurHandler = function () {
                _this.deactivateFocus();
            };
            _this.inputInputHandler = function () {
                _this.handleInput();
            };
            _this.setPointerXOffset = function (evt) {
                _this.setTransformOrigin(evt);
            };
            _this.textFieldInteractionHandler = function () {
                _this.handleTextFieldInteraction();
            };
            _this.validationAttributeChangeHandler = function (attributesList) {
                _this.handleValidationAttributeChange(attributesList);
            };
            return _this;
        }
        Object.defineProperty(MDCTextFieldFoundation, "cssClasses", {
            get: function () {
                return cssClasses;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCTextFieldFoundation, "strings", {
            get: function () {
                return strings;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCTextFieldFoundation, "numbers", {
            get: function () {
                return numbers;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCTextFieldFoundation.prototype, "shouldAlwaysFloat", {
            get: function () {
                var type = this.getNativeInput().type;
                return ALWAYS_FLOAT_TYPES.indexOf(type) >= 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCTextFieldFoundation.prototype, "shouldFloat", {
            get: function () {
                return this.shouldAlwaysFloat || this.isFocused || !!this.getValue() ||
                    this.isBadInput();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCTextFieldFoundation.prototype, "shouldShake", {
            get: function () {
                return !this.isFocused && !this.isValid() && !!this.getValue();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(MDCTextFieldFoundation, "defaultAdapter", {
            /**
             * See {@link MDCTextFieldAdapter} for typing information on parameters and
             * return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return true; },
                    setInputAttr: function () { return undefined; },
                    removeInputAttr: function () { return undefined; },
                    registerTextFieldInteractionHandler: function () { return undefined; },
                    deregisterTextFieldInteractionHandler: function () { return undefined; },
                    registerInputInteractionHandler: function () { return undefined; },
                    deregisterInputInteractionHandler: function () { return undefined; },
                    registerValidationAttributeChangeHandler: function () {
                        return new MutationObserver(function () { return undefined; });
                    },
                    deregisterValidationAttributeChangeHandler: function () { return undefined; },
                    getNativeInput: function () { return null; },
                    isFocused: function () { return false; },
                    activateLineRipple: function () { return undefined; },
                    deactivateLineRipple: function () { return undefined; },
                    setLineRippleTransformOrigin: function () { return undefined; },
                    shakeLabel: function () { return undefined; },
                    floatLabel: function () { return undefined; },
                    setLabelRequired: function () { return undefined; },
                    hasLabel: function () { return false; },
                    getLabelWidth: function () { return 0; },
                    hasOutline: function () { return false; },
                    notchOutline: function () { return undefined; },
                    closeOutline: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: false,
            configurable: true
        });
        MDCTextFieldFoundation.prototype.init = function () {
            var e_1, _a, e_2, _b;
            if (this.adapter.hasLabel() && this.getNativeInput().required) {
                this.adapter.setLabelRequired(true);
            }
            if (this.adapter.isFocused()) {
                this.inputFocusHandler();
            }
            else if (this.adapter.hasLabel() && this.shouldFloat) {
                this.notchOutline(true);
                this.adapter.floatLabel(true);
                this.styleFloating(true);
            }
            this.adapter.registerInputInteractionHandler('focus', this.inputFocusHandler);
            this.adapter.registerInputInteractionHandler('blur', this.inputBlurHandler);
            this.adapter.registerInputInteractionHandler('input', this.inputInputHandler);
            try {
                for (var POINTERDOWN_EVENTS_1 = __values$1(POINTERDOWN_EVENTS), POINTERDOWN_EVENTS_1_1 = POINTERDOWN_EVENTS_1.next(); !POINTERDOWN_EVENTS_1_1.done; POINTERDOWN_EVENTS_1_1 = POINTERDOWN_EVENTS_1.next()) {
                    var evtType = POINTERDOWN_EVENTS_1_1.value;
                    this.adapter.registerInputInteractionHandler(evtType, this.setPointerXOffset);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (POINTERDOWN_EVENTS_1_1 && !POINTERDOWN_EVENTS_1_1.done && (_a = POINTERDOWN_EVENTS_1.return)) _a.call(POINTERDOWN_EVENTS_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                for (var INTERACTION_EVENTS_1 = __values$1(INTERACTION_EVENTS), INTERACTION_EVENTS_1_1 = INTERACTION_EVENTS_1.next(); !INTERACTION_EVENTS_1_1.done; INTERACTION_EVENTS_1_1 = INTERACTION_EVENTS_1.next()) {
                    var evtType = INTERACTION_EVENTS_1_1.value;
                    this.adapter.registerTextFieldInteractionHandler(evtType, this.textFieldInteractionHandler);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (INTERACTION_EVENTS_1_1 && !INTERACTION_EVENTS_1_1.done && (_b = INTERACTION_EVENTS_1.return)) _b.call(INTERACTION_EVENTS_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            this.validationObserver =
                this.adapter.registerValidationAttributeChangeHandler(this.validationAttributeChangeHandler);
            this.setcharacterCounter(this.getValue().length);
        };
        MDCTextFieldFoundation.prototype.destroy = function () {
            var e_3, _a, e_4, _b;
            this.adapter.deregisterInputInteractionHandler('focus', this.inputFocusHandler);
            this.adapter.deregisterInputInteractionHandler('blur', this.inputBlurHandler);
            this.adapter.deregisterInputInteractionHandler('input', this.inputInputHandler);
            try {
                for (var POINTERDOWN_EVENTS_2 = __values$1(POINTERDOWN_EVENTS), POINTERDOWN_EVENTS_2_1 = POINTERDOWN_EVENTS_2.next(); !POINTERDOWN_EVENTS_2_1.done; POINTERDOWN_EVENTS_2_1 = POINTERDOWN_EVENTS_2.next()) {
                    var evtType = POINTERDOWN_EVENTS_2_1.value;
                    this.adapter.deregisterInputInteractionHandler(evtType, this.setPointerXOffset);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (POINTERDOWN_EVENTS_2_1 && !POINTERDOWN_EVENTS_2_1.done && (_a = POINTERDOWN_EVENTS_2.return)) _a.call(POINTERDOWN_EVENTS_2);
                }
                finally { if (e_3) throw e_3.error; }
            }
            try {
                for (var INTERACTION_EVENTS_2 = __values$1(INTERACTION_EVENTS), INTERACTION_EVENTS_2_1 = INTERACTION_EVENTS_2.next(); !INTERACTION_EVENTS_2_1.done; INTERACTION_EVENTS_2_1 = INTERACTION_EVENTS_2.next()) {
                    var evtType = INTERACTION_EVENTS_2_1.value;
                    this.adapter.deregisterTextFieldInteractionHandler(evtType, this.textFieldInteractionHandler);
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (INTERACTION_EVENTS_2_1 && !INTERACTION_EVENTS_2_1.done && (_b = INTERACTION_EVENTS_2.return)) _b.call(INTERACTION_EVENTS_2);
                }
                finally { if (e_4) throw e_4.error; }
            }
            this.adapter.deregisterValidationAttributeChangeHandler(this.validationObserver);
        };
        /**
         * Handles user interactions with the Text Field.
         */
        MDCTextFieldFoundation.prototype.handleTextFieldInteraction = function () {
            var nativeInput = this.adapter.getNativeInput();
            if (nativeInput && nativeInput.disabled) {
                return;
            }
            this.receivedUserInput = true;
        };
        /**
         * Handles validation attribute changes
         */
        MDCTextFieldFoundation.prototype.handleValidationAttributeChange = function (attributesList) {
            var _this = this;
            attributesList.some(function (attributeName) {
                if (VALIDATION_ATTR_WHITELIST.indexOf(attributeName) > -1) {
                    _this.styleValidity(true);
                    _this.adapter.setLabelRequired(_this.getNativeInput().required);
                    return true;
                }
                return false;
            });
            if (attributesList.indexOf('maxlength') > -1) {
                this.setcharacterCounter(this.getValue().length);
            }
        };
        /**
         * Opens/closes the notched outline.
         */
        MDCTextFieldFoundation.prototype.notchOutline = function (openNotch) {
            if (!this.adapter.hasOutline() || !this.adapter.hasLabel()) {
                return;
            }
            if (openNotch) {
                var labelWidth = this.adapter.getLabelWidth() * numbers.LABEL_SCALE;
                this.adapter.notchOutline(labelWidth);
            }
            else {
                this.adapter.closeOutline();
            }
        };
        /**
         * Activates the text field focus state.
         */
        MDCTextFieldFoundation.prototype.activateFocus = function () {
            this.isFocused = true;
            this.styleFocused(this.isFocused);
            this.adapter.activateLineRipple();
            if (this.adapter.hasLabel()) {
                this.notchOutline(this.shouldFloat);
                this.adapter.floatLabel(this.shouldFloat);
                this.styleFloating(this.shouldFloat);
                this.adapter.shakeLabel(this.shouldShake);
            }
            if (this.helperText &&
                (this.helperText.isPersistent() || !this.helperText.isValidation() ||
                    !this.valid)) {
                this.helperText.showToScreenReader();
            }
        };
        /**
         * Sets the line ripple's transform origin, so that the line ripple activate
         * animation will animate out from the user's click location.
         */
        MDCTextFieldFoundation.prototype.setTransformOrigin = function (evt) {
            if (this.isDisabled() || this.adapter.hasOutline()) {
                return;
            }
            var touches = evt.touches;
            var targetEvent = touches ? touches[0] : evt;
            var targetClientRect = targetEvent.target.getBoundingClientRect();
            var normalizedX = targetEvent.clientX - targetClientRect.left;
            this.adapter.setLineRippleTransformOrigin(normalizedX);
        };
        /**
         * Handles input change of text input and text area.
         */
        MDCTextFieldFoundation.prototype.handleInput = function () {
            this.autoCompleteFocus();
            this.setcharacterCounter(this.getValue().length);
        };
        /**
         * Activates the Text Field's focus state in cases when the input value
         * changes without user input (e.g. programmatically).
         */
        MDCTextFieldFoundation.prototype.autoCompleteFocus = function () {
            if (!this.receivedUserInput) {
                this.activateFocus();
            }
        };
        /**
         * Deactivates the Text Field's focus state.
         */
        MDCTextFieldFoundation.prototype.deactivateFocus = function () {
            this.isFocused = false;
            this.adapter.deactivateLineRipple();
            var isValid = this.isValid();
            this.styleValidity(isValid);
            this.styleFocused(this.isFocused);
            if (this.adapter.hasLabel()) {
                this.notchOutline(this.shouldFloat);
                this.adapter.floatLabel(this.shouldFloat);
                this.styleFloating(this.shouldFloat);
                this.adapter.shakeLabel(this.shouldShake);
            }
            if (!this.shouldFloat) {
                this.receivedUserInput = false;
            }
        };
        MDCTextFieldFoundation.prototype.getValue = function () {
            return this.getNativeInput().value;
        };
        /**
         * @param value The value to set on the input Element.
         */
        MDCTextFieldFoundation.prototype.setValue = function (value) {
            // Prevent Safari from moving the caret to the end of the input when the
            // value has not changed.
            if (this.getValue() !== value) {
                this.getNativeInput().value = value;
            }
            this.setcharacterCounter(value.length);
            if (this.validateOnValueChange) {
                var isValid = this.isValid();
                this.styleValidity(isValid);
            }
            if (this.adapter.hasLabel()) {
                this.notchOutline(this.shouldFloat);
                this.adapter.floatLabel(this.shouldFloat);
                this.styleFloating(this.shouldFloat);
                if (this.validateOnValueChange) {
                    this.adapter.shakeLabel(this.shouldShake);
                }
            }
        };
        /**
         * @return The custom validity state, if set; otherwise, the result of a
         *     native validity check.
         */
        MDCTextFieldFoundation.prototype.isValid = function () {
            return this.useNativeValidation ? this.isNativeInputValid() : this.valid;
        };
        /**
         * @param isValid Sets the custom validity state of the Text Field.
         */
        MDCTextFieldFoundation.prototype.setValid = function (isValid) {
            this.valid = isValid;
            this.styleValidity(isValid);
            var shouldShake = !isValid && !this.isFocused && !!this.getValue();
            if (this.adapter.hasLabel()) {
                this.adapter.shakeLabel(shouldShake);
            }
        };
        /**
         * @param shouldValidate Whether or not validity should be updated on
         *     value change.
         */
        MDCTextFieldFoundation.prototype.setValidateOnValueChange = function (shouldValidate) {
            this.validateOnValueChange = shouldValidate;
        };
        /**
         * @return Whether or not validity should be updated on value change. `true`
         *     by default.
         */
        MDCTextFieldFoundation.prototype.getValidateOnValueChange = function () {
            return this.validateOnValueChange;
        };
        /**
         * Enables or disables the use of native validation. Use this for custom
         * validation.
         * @param useNativeValidation Set this to false to ignore native input
         *     validation.
         */
        MDCTextFieldFoundation.prototype.setUseNativeValidation = function (useNativeValidation) {
            this.useNativeValidation = useNativeValidation;
        };
        MDCTextFieldFoundation.prototype.isDisabled = function () {
            return this.getNativeInput().disabled;
        };
        /**
         * @param disabled Sets the text-field disabled or enabled.
         */
        MDCTextFieldFoundation.prototype.setDisabled = function (disabled) {
            this.getNativeInput().disabled = disabled;
            this.styleDisabled(disabled);
        };
        /**
         * @param content Sets the content of the helper text.
         */
        MDCTextFieldFoundation.prototype.setHelperTextContent = function (content) {
            if (this.helperText) {
                this.helperText.setContent(content);
            }
        };
        /**
         * Sets the aria label of the leading icon.
         */
        MDCTextFieldFoundation.prototype.setLeadingIconAriaLabel = function (label) {
            if (this.leadingIcon) {
                this.leadingIcon.setAriaLabel(label);
            }
        };
        /**
         * Sets the text content of the leading icon.
         */
        MDCTextFieldFoundation.prototype.setLeadingIconContent = function (content) {
            if (this.leadingIcon) {
                this.leadingIcon.setContent(content);
            }
        };
        /**
         * Sets the aria label of the trailing icon.
         */
        MDCTextFieldFoundation.prototype.setTrailingIconAriaLabel = function (label) {
            if (this.trailingIcon) {
                this.trailingIcon.setAriaLabel(label);
            }
        };
        /**
         * Sets the text content of the trailing icon.
         */
        MDCTextFieldFoundation.prototype.setTrailingIconContent = function (content) {
            if (this.trailingIcon) {
                this.trailingIcon.setContent(content);
            }
        };
        /**
         * Sets character counter values that shows characters used and the total
         * character limit.
         */
        MDCTextFieldFoundation.prototype.setcharacterCounter = function (currentLength) {
            if (!this.characterCounter) {
                return;
            }
            var maxLength = this.getNativeInput().maxLength;
            if (maxLength === -1) {
                throw new Error('MDCTextFieldFoundation: Expected maxlength html property on text input or textarea.');
            }
            this.characterCounter.setCounterValue(currentLength, maxLength);
        };
        /**
         * @return True if the Text Field input fails in converting the user-supplied
         *     value.
         */
        MDCTextFieldFoundation.prototype.isBadInput = function () {
            // The badInput property is not supported in IE 11 💩.
            return this.getNativeInput().validity.badInput || false;
        };
        /**
         * @return The result of native validity checking (ValidityState.valid).
         */
        MDCTextFieldFoundation.prototype.isNativeInputValid = function () {
            return this.getNativeInput().validity.valid;
        };
        /**
         * Styles the component based on the validity state.
         */
        MDCTextFieldFoundation.prototype.styleValidity = function (isValid) {
            var INVALID = MDCTextFieldFoundation.cssClasses.INVALID;
            if (isValid) {
                this.adapter.removeClass(INVALID);
            }
            else {
                this.adapter.addClass(INVALID);
            }
            if (this.helperText) {
                this.helperText.setValidity(isValid);
                // We dynamically set or unset aria-describedby for validation helper text
                // only, based on whether the field is valid
                var helperTextValidation = this.helperText.isValidation();
                if (!helperTextValidation) {
                    return;
                }
                var helperTextVisible = this.helperText.isVisible();
                var helperTextId = this.helperText.getId();
                if (helperTextVisible && helperTextId) {
                    this.adapter.setInputAttr(strings.ARIA_DESCRIBEDBY, helperTextId);
                }
                else {
                    this.adapter.removeInputAttr(strings.ARIA_DESCRIBEDBY);
                }
            }
        };
        /**
         * Styles the component based on the focused state.
         */
        MDCTextFieldFoundation.prototype.styleFocused = function (isFocused) {
            var FOCUSED = MDCTextFieldFoundation.cssClasses.FOCUSED;
            if (isFocused) {
                this.adapter.addClass(FOCUSED);
            }
            else {
                this.adapter.removeClass(FOCUSED);
            }
        };
        /**
         * Styles the component based on the disabled state.
         */
        MDCTextFieldFoundation.prototype.styleDisabled = function (isDisabled) {
            var _a = MDCTextFieldFoundation.cssClasses, DISABLED = _a.DISABLED, INVALID = _a.INVALID;
            if (isDisabled) {
                this.adapter.addClass(DISABLED);
                this.adapter.removeClass(INVALID);
            }
            else {
                this.adapter.removeClass(DISABLED);
            }
            if (this.leadingIcon) {
                this.leadingIcon.setDisabled(isDisabled);
            }
            if (this.trailingIcon) {
                this.trailingIcon.setDisabled(isDisabled);
            }
        };
        /**
         * Styles the component based on the label floating state.
         */
        MDCTextFieldFoundation.prototype.styleFloating = function (isFloating) {
            var LABEL_FLOATING = MDCTextFieldFoundation.cssClasses.LABEL_FLOATING;
            if (isFloating) {
                this.adapter.addClass(LABEL_FLOATING);
            }
            else {
                this.adapter.removeClass(LABEL_FLOATING);
            }
        };
        /**
         * @return The native text input element from the host environment, or an
         *     object with the same shape for unit tests.
         */
        MDCTextFieldFoundation.prototype.getNativeInput = function () {
            // this.adapter may be undefined in foundation unit tests. This happens when
            // testdouble is creating a mock object and invokes the
            // shouldShake/shouldFloat getters (which in turn call getValue(), which
            // calls this method) before init() has been called from the MDCTextField
            // constructor. To work around that issue, we return a dummy object.
            var nativeInput = this.adapter ? this.adapter.getNativeInput() : null;
            return nativeInput || {
                disabled: false,
                maxLength: -1,
                required: false,
                type: 'input',
                validity: {
                    badInput: false,
                    valid: true,
                },
                value: '',
            };
        };
        return MDCTextFieldFoundation;
    }(MDCFoundation));
    // tslint:disable-next-line:no-default-export Needed for backward compatibility with MDC Web v0.44.0 and earlier.
    var MDCTextFieldFoundation$1 = MDCTextFieldFoundation;

    /**
     * @license
     * Copyright 2020 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */const e=o=>void 0===o.strings,f={},s=(o,l=f)=>o._$AH=l;

    /**
     * @license
     * Copyright 2020 Google LLC
     * SPDX-License-Identifier: BSD-3-Clause
     */const l=e$1(class extends i$1{constructor(r){if(super(r),r.type!==t.PROPERTY&&r.type!==t.ATTRIBUTE&&r.type!==t.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!e(r))throw Error("`live` bindings can only contain a single expression")}render(r){return r}update(i,[t$1]){if(t$1===x||t$1===b)return t$1;const o=i.element,l=i.name;if(i.type===t.PROPERTY){if(t$1===o[l])return x}else if(i.type===t.BOOLEAN_ATTRIBUTE){if(!!t$1===o.hasAttribute(l))return x}else if(i.type===t.ATTRIBUTE&&o.getAttribute(l)===t$1+"")return x;return s(i),t$1}});

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    const passiveEvents = ['touchstart', 'touchmove', 'scroll', 'mousewheel'];
    const createValidityObj = (customValidity = {}) => {
        /*
         * We need to make ValidityState an object because it is readonly and
         * we cannot use the spread operator. Also, we don't export
         * `CustomValidityState` because it is a leaky implementation and the user
         * already has access to `ValidityState` in lib.dom.ts. Also an interface
         * {a: Type} can be casted to {readonly a: Type} so passing any object
         * should be fine.
         */
        const objectifiedCustomValidity = {};
        // eslint-disable-next-line guard-for-in
        for (const propName in customValidity) {
            /*
             * Casting is needed because ValidityState's props are all readonly and
             * thus cannot be set on `onjectifiedCustomValidity`. In the end, the
             * interface is the same as ValidityState (but not readonly), but the
             * function signature casts the output to ValidityState (thus readonly).
             */
            objectifiedCustomValidity[propName] =
                customValidity[propName];
        }
        return Object.assign({ badInput: false, customError: false, patternMismatch: false, rangeOverflow: false, rangeUnderflow: false, stepMismatch: false, tooLong: false, tooShort: false, typeMismatch: false, valid: true, valueMissing: false }, objectifiedCustomValidity);
    };
    /** @soyCompatible */
    class TextFieldBase extends FormElement {
        constructor() {
            super(...arguments);
            this.mdcFoundationClass = MDCTextFieldFoundation$1;
            this.value = '';
            this.type = 'text';
            this.placeholder = '';
            this.label = '';
            this.icon = '';
            this.iconTrailing = '';
            this.disabled = false;
            this.required = false;
            this.minLength = -1;
            this.maxLength = -1;
            this.outlined = false;
            this.helper = '';
            this.validateOnInitialRender = false;
            this.validationMessage = '';
            this.autoValidate = false;
            this.pattern = '';
            this.min = '';
            this.max = '';
            /**
             * step can be a number or the keyword "any".
             *
             * Use `String` typing to pass down the value as a string and let the native
             * input cast internally as needed.
             */
            this.step = null;
            this.size = null;
            this.helperPersistent = false;
            this.charCounter = false;
            this.endAligned = false;
            this.prefix = '';
            this.suffix = '';
            this.name = '';
            this.readOnly = false;
            this.autocapitalize = '';
            this.outlineOpen = false;
            this.outlineWidth = 0;
            this.isUiValid = true;
            this.focused = false;
            this._validity = createValidityObj();
            this.validityTransform = null;
        }
        get validity() {
            this._checkValidity(this.value);
            return this._validity;
        }
        get willValidate() {
            return this.formElement.willValidate;
        }
        get selectionStart() {
            return this.formElement.selectionStart;
        }
        get selectionEnd() {
            return this.formElement.selectionEnd;
        }
        focus() {
            const focusEvt = new CustomEvent('focus');
            this.formElement.dispatchEvent(focusEvt);
            this.formElement.focus();
        }
        blur() {
            const blurEvt = new CustomEvent('blur');
            this.formElement.dispatchEvent(blurEvt);
            this.formElement.blur();
        }
        select() {
            this.formElement.select();
        }
        setSelectionRange(selectionStart, selectionEnd, selectionDirection) {
            this.formElement.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
        }
        update(changedProperties) {
            if (changedProperties.has('autoValidate') && this.mdcFoundation) {
                this.mdcFoundation.setValidateOnValueChange(this.autoValidate);
            }
            if (changedProperties.has('value') && typeof this.value !== 'string') {
                this.value = `${this.value}`;
            }
            super.update(changedProperties);
        }
        setFormData(formData) {
            if (this.name) {
                formData.append(this.name, this.value);
            }
        }
        /** @soyTemplate */
        render() {
            const shouldRenderCharCounter = this.charCounter && this.maxLength !== -1;
            const shouldRenderHelperText = !!this.helper || !!this.validationMessage || shouldRenderCharCounter;
            /** @classMap */
            const classes = {
                'mdc-text-field--disabled': this.disabled,
                'mdc-text-field--no-label': !this.label,
                'mdc-text-field--filled': !this.outlined,
                'mdc-text-field--outlined': this.outlined,
                'mdc-text-field--with-leading-icon': this.icon,
                'mdc-text-field--with-trailing-icon': this.iconTrailing,
                'mdc-text-field--end-aligned': this.endAligned,
            };
            return y `
      <label class="mdc-text-field ${o(classes)}">
        ${this.renderRipple()}
        ${this.outlined ? this.renderOutline() : this.renderLabel()}
        ${this.renderLeadingIcon()}
        ${this.renderPrefix()}
        ${this.renderInput(shouldRenderHelperText)}
        ${this.renderSuffix()}
        ${this.renderTrailingIcon()}
        ${this.renderLineRipple()}
      </label>
      ${this.renderHelperText(shouldRenderHelperText, shouldRenderCharCounter)}
    `;
        }
        updated(changedProperties) {
            if (changedProperties.has('value') &&
                changedProperties.get('value') !== undefined) {
                this.mdcFoundation.setValue(this.value);
                if (this.autoValidate) {
                    this.reportValidity();
                }
            }
        }
        /** @soyTemplate */
        renderRipple() {
            return this.outlined ? '' : y `
      <span class="mdc-text-field__ripple"></span>
    `;
        }
        /** @soyTemplate */
        renderOutline() {
            return !this.outlined ? '' : y `
      <mwc-notched-outline
          .width=${this.outlineWidth}
          .open=${this.outlineOpen}
          class="mdc-notched-outline">
        ${this.renderLabel()}
      </mwc-notched-outline>`;
        }
        /** @soyTemplate */
        renderLabel() {
            return !this.label ?
                '' :
                y `
      <span
          .floatingLabelFoundation=${floatingLabel(this.label)}
          id="label">${this.label}</span>
    `;
        }
        /** @soyTemplate */
        renderLeadingIcon() {
            return this.icon ? this.renderIcon(this.icon) : '';
        }
        /** @soyTemplate */
        renderTrailingIcon() {
            return this.iconTrailing ? this.renderIcon(this.iconTrailing, true) : '';
        }
        /** @soyTemplate */
        renderIcon(icon, isTrailingIcon = false) {
            /** @classMap */
            const classes = {
                'mdc-text-field__icon--leading': !isTrailingIcon,
                'mdc-text-field__icon--trailing': isTrailingIcon
            };
            return y `<i class="material-icons mdc-text-field__icon ${o(classes)}">${icon}</i>`;
        }
        /** @soyTemplate */
        renderPrefix() {
            return this.prefix ? this.renderAffix(this.prefix) : '';
        }
        /** @soyTemplate */
        renderSuffix() {
            return this.suffix ? this.renderAffix(this.suffix, true) : '';
        }
        /** @soyTemplate */
        renderAffix(content, isSuffix = false) {
            /** @classMap */
            const classes = {
                'mdc-text-field__affix--prefix': !isSuffix,
                'mdc-text-field__affix--suffix': isSuffix
            };
            return y `<span class="mdc-text-field__affix ${o(classes)}">
        ${content}</span>`;
        }
        /** @soyTemplate */
        renderInput(shouldRenderHelperText) {
            const minOrUndef = this.minLength === -1 ? undefined : this.minLength;
            const maxOrUndef = this.maxLength === -1 ? undefined : this.maxLength;
            const autocapitalizeOrUndef = this.autocapitalize ?
                this.autocapitalize :
                undefined;
            const showValidationMessage = this.validationMessage && !this.isUiValid;
            const ariaLabelledbyOrUndef = !!this.label ? 'label' : undefined;
            const ariaControlsOrUndef = shouldRenderHelperText ? 'helper-text' : undefined;
            const ariaDescribedbyOrUndef = this.focused || this.helperPersistent || showValidationMessage ?
                'helper-text' :
                undefined;
            // TODO: live() directive needs casting for lit-analyzer
            // https://github.com/runem/lit-analyzer/pull/91/files
            // TODO: lit-analyzer labels min/max as (number|string) instead of string
            return y `
      <input
          aria-labelledby=${l$1(ariaLabelledbyOrUndef)}
          aria-controls="${l$1(ariaControlsOrUndef)}"
          aria-describedby="${l$1(ariaDescribedbyOrUndef)}"
          class="mdc-text-field__input"
          type="${this.type}"
          .value="${l(this.value)}"
          ?disabled="${this.disabled}"
          placeholder="${this.placeholder}"
          ?required="${this.required}"
          ?readonly="${this.readOnly}"
          minlength="${l$1(minOrUndef)}"
          maxlength="${l$1(maxOrUndef)}"
          pattern="${l$1(this.pattern ? this.pattern : undefined)}"
          min="${l$1(this.min === '' ? undefined : this.min)}"
          max="${l$1(this.max === '' ? undefined : this.max)}"
          step="${l$1(this.step === null ? undefined : this.step)}"
          size="${l$1(this.size === null ? undefined : this.size)}"
          name="${l$1(this.name === '' ? undefined : this.name)}"
          inputmode="${l$1(this.inputMode)}"
          autocapitalize="${l$1(autocapitalizeOrUndef)}"
          @input="${this.handleInputChange}"
          @focus="${this.onInputFocus}"
          @blur="${this.onInputBlur}">`;
        }
        /** @soyTemplate */
        renderLineRipple() {
            return this.outlined ?
                '' :
                y `
      <span .lineRippleFoundation=${lineRipple()}></span>
    `;
        }
        /** @soyTemplate */
        renderHelperText(shouldRenderHelperText, shouldRenderCharCounter) {
            const showValidationMessage = this.validationMessage && !this.isUiValid;
            /** @classMap */
            const classes = {
                'mdc-text-field-helper-text--persistent': this.helperPersistent,
                'mdc-text-field-helper-text--validation-msg': showValidationMessage,
            };
            const ariaHiddenOrUndef = this.focused || this.helperPersistent || showValidationMessage ?
                undefined :
                'true';
            const helperText = showValidationMessage ? this.validationMessage : this.helper;
            return !shouldRenderHelperText ? '' : y `
      <div class="mdc-text-field-helper-line">
        <div id="helper-text"
             aria-hidden="${l$1(ariaHiddenOrUndef)}"
             class="mdc-text-field-helper-text ${o(classes)}"
             >${helperText}</div>
        ${this.renderCharCounter(shouldRenderCharCounter)}
      </div>`;
        }
        /** @soyTemplate */
        renderCharCounter(shouldRenderCharCounter) {
            const length = Math.min(this.value.length, this.maxLength);
            return !shouldRenderCharCounter ? '' : y `
      <span class="mdc-text-field-character-counter"
            >${length} / ${this.maxLength}</span>`;
        }
        onInputFocus() {
            this.focused = true;
        }
        onInputBlur() {
            this.focused = false;
            this.reportValidity();
        }
        checkValidity() {
            const isValid = this._checkValidity(this.value);
            if (!isValid) {
                const invalidEvent = new Event('invalid', { bubbles: false, cancelable: true });
                this.dispatchEvent(invalidEvent);
            }
            return isValid;
        }
        reportValidity() {
            const isValid = this.checkValidity();
            this.mdcFoundation.setValid(isValid);
            this.isUiValid = isValid;
            return isValid;
        }
        _checkValidity(value) {
            const nativeValidity = this.formElement.validity;
            let validity = createValidityObj(nativeValidity);
            if (this.validityTransform) {
                const customValidity = this.validityTransform(value, validity);
                validity = Object.assign(Object.assign({}, validity), customValidity);
                this.mdcFoundation.setUseNativeValidation(false);
            }
            else {
                this.mdcFoundation.setUseNativeValidation(true);
            }
            this._validity = validity;
            return this._validity.valid;
        }
        setCustomValidity(message) {
            this.validationMessage = message;
            this.formElement.setCustomValidity(message);
        }
        handleInputChange() {
            this.value = this.formElement.value;
        }
        createAdapter() {
            return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, this.getRootAdapterMethods()), this.getInputAdapterMethods()), this.getLabelAdapterMethods()), this.getLineRippleAdapterMethods()), this.getOutlineAdapterMethods());
        }
        getRootAdapterMethods() {
            return Object.assign({ registerTextFieldInteractionHandler: (evtType, handler) => this.addEventListener(evtType, handler), deregisterTextFieldInteractionHandler: (evtType, handler) => this.removeEventListener(evtType, handler), registerValidationAttributeChangeHandler: (handler) => {
                    const getAttributesList = (mutationsList) => {
                        return mutationsList.map((mutation) => mutation.attributeName)
                            .filter((attributeName) => attributeName);
                    };
                    const observer = new MutationObserver((mutationsList) => {
                        handler(getAttributesList(mutationsList));
                    });
                    const config = { attributes: true };
                    observer.observe(this.formElement, config);
                    return observer;
                }, deregisterValidationAttributeChangeHandler: (observer) => observer.disconnect() }, addHasRemoveClass(this.mdcRoot));
        }
        getInputAdapterMethods() {
            return {
                getNativeInput: () => this.formElement,
                // since HelperTextFoundation is not used, aria-describedby a11y logic
                // is implemented in render method instead of these adapter methods
                setInputAttr: () => undefined,
                removeInputAttr: () => undefined,
                isFocused: () => this.shadowRoot ?
                    this.shadowRoot.activeElement === this.formElement :
                    false,
                registerInputInteractionHandler: (evtType, handler) => this.formElement.addEventListener(evtType, handler, { passive: evtType in passiveEvents }),
                deregisterInputInteractionHandler: (evtType, handler) => this.formElement.removeEventListener(evtType, handler),
            };
        }
        getLabelAdapterMethods() {
            return {
                floatLabel: (shouldFloat) => this.labelElement &&
                    this.labelElement.floatingLabelFoundation.float(shouldFloat),
                getLabelWidth: () => {
                    return this.labelElement ?
                        this.labelElement.floatingLabelFoundation.getWidth() :
                        0;
                },
                hasLabel: () => Boolean(this.labelElement),
                shakeLabel: (shouldShake) => this.labelElement &&
                    this.labelElement.floatingLabelFoundation.shake(shouldShake),
                setLabelRequired: (isRequired) => {
                    if (this.labelElement) {
                        this.labelElement.floatingLabelFoundation.setRequired(isRequired);
                    }
                },
            };
        }
        getLineRippleAdapterMethods() {
            return {
                activateLineRipple: () => {
                    if (this.lineRippleElement) {
                        this.lineRippleElement.lineRippleFoundation.activate();
                    }
                },
                deactivateLineRipple: () => {
                    if (this.lineRippleElement) {
                        this.lineRippleElement.lineRippleFoundation.deactivate();
                    }
                },
                setLineRippleTransformOrigin: (normalizedX) => {
                    if (this.lineRippleElement) {
                        this.lineRippleElement.lineRippleFoundation.setRippleCenter(normalizedX);
                    }
                },
            };
        }
        // tslint:disable:ban-ts-ignore
        async getUpdateComplete() {
            var _a;
            // @ts-ignore
            const result = await super.getUpdateComplete();
            await ((_a = this.outlineElement) === null || _a === void 0 ? void 0 : _a.updateComplete);
            return result;
        }
        // tslint:enable:ban-ts-ignore
        firstUpdated() {
            var _a;
            super.firstUpdated();
            this.mdcFoundation.setValidateOnValueChange(this.autoValidate);
            if (this.validateOnInitialRender) {
                this.reportValidity();
            }
            // wait for the outline element to render to update the notch width
            (_a = this.outlineElement) === null || _a === void 0 ? void 0 : _a.updateComplete.then(() => {
                var _a;
                // `foundation.notchOutline()` assumes the label isn't floating and
                // multiplies by a constant, but the label is already is floating at this
                // stage, therefore directly set the outline width to the label width
                this.outlineWidth =
                    ((_a = this.labelElement) === null || _a === void 0 ? void 0 : _a.floatingLabelFoundation.getWidth()) || 0;
            });
        }
        getOutlineAdapterMethods() {
            return {
                closeOutline: () => this.outlineElement && (this.outlineOpen = false),
                hasOutline: () => Boolean(this.outlineElement),
                notchOutline: (labelWidth) => {
                    const outlineElement = this.outlineElement;
                    if (outlineElement && !this.outlineOpen) {
                        this.outlineWidth = labelWidth;
                        this.outlineOpen = true;
                    }
                }
            };
        }
        async layout() {
            await this.updateComplete;
            const labelElement = this.labelElement;
            if (!labelElement) {
                this.outlineOpen = false;
                return;
            }
            const shouldFloat = !!this.label && !!this.value;
            labelElement.floatingLabelFoundation.float(shouldFloat);
            if (!this.outlined) {
                return;
            }
            this.outlineOpen = shouldFloat;
            await this.updateComplete;
            /* When the textfield automatically notches due to a value and label
             * being defined, the textfield may be set to `display: none` by the user.
             * this means that the notch is of size 0px. We provide this function so
             * that the user may manually resize the notch to the floated label's
             * width.
             */
            const labelWidth = labelElement.floatingLabelFoundation.getWidth();
            if (this.outlineOpen) {
                this.outlineWidth = labelWidth;
                await this.updateComplete;
            }
        }
    }
    __decorate$2([
        i$4('.mdc-text-field')
    ], TextFieldBase.prototype, "mdcRoot", void 0);
    __decorate$2([
        i$4('input')
    ], TextFieldBase.prototype, "formElement", void 0);
    __decorate$2([
        i$4('.mdc-floating-label')
    ], TextFieldBase.prototype, "labelElement", void 0);
    __decorate$2([
        i$4('.mdc-line-ripple')
    ], TextFieldBase.prototype, "lineRippleElement", void 0);
    __decorate$2([
        i$4('mwc-notched-outline')
    ], TextFieldBase.prototype, "outlineElement", void 0);
    __decorate$2([
        i$4('.mdc-notched-outline__notch')
    ], TextFieldBase.prototype, "notchElement", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "value", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "type", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "placeholder", void 0);
    __decorate$2([
        e$9({ type: String }),
        observer(function (_newVal, oldVal) {
            if (oldVal !== undefined && this.label !== oldVal) {
                this.layout();
            }
        })
    ], TextFieldBase.prototype, "label", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "icon", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "iconTrailing", void 0);
    __decorate$2([
        e$9({ type: Boolean, reflect: true })
    ], TextFieldBase.prototype, "disabled", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "required", void 0);
    __decorate$2([
        e$9({ type: Number })
    ], TextFieldBase.prototype, "minLength", void 0);
    __decorate$2([
        e$9({ type: Number })
    ], TextFieldBase.prototype, "maxLength", void 0);
    __decorate$2([
        e$9({ type: Boolean, reflect: true }),
        observer(function (_newVal, oldVal) {
            if (oldVal !== undefined && this.outlined !== oldVal) {
                this.layout();
            }
        })
    ], TextFieldBase.prototype, "outlined", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "helper", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "validateOnInitialRender", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "validationMessage", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "autoValidate", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "pattern", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "min", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "max", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "step", void 0);
    __decorate$2([
        e$9({ type: Number })
    ], TextFieldBase.prototype, "size", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "helperPersistent", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "charCounter", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "endAligned", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "prefix", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "suffix", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "name", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "inputMode", void 0);
    __decorate$2([
        e$9({ type: Boolean })
    ], TextFieldBase.prototype, "readOnly", void 0);
    __decorate$2([
        e$9({ type: String })
    ], TextFieldBase.prototype, "autocapitalize", void 0);
    __decorate$2([
        t$4()
    ], TextFieldBase.prototype, "outlineOpen", void 0);
    __decorate$2([
        t$4()
    ], TextFieldBase.prototype, "outlineWidth", void 0);
    __decorate$2([
        t$4()
    ], TextFieldBase.prototype, "isUiValid", void 0);
    __decorate$2([
        t$4()
    ], TextFieldBase.prototype, "focused", void 0);
    __decorate$2([
        e$8({ passive: true })
    ], TextFieldBase.prototype, "handleInputChange", null);

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    const booleanOrStringConverter = {
        fromAttribute(value) {
            if (value === null) {
                return false;
            }
            else if (value === '') {
                return true;
            }
            return value;
        },
        toAttribute(value) {
            if (typeof value === 'boolean') {
                return value ? '' : null;
            }
            return value;
        }
    };
    /** @soyCompatible */
    class TextAreaBase extends TextFieldBase {
        constructor() {
            super(...arguments);
            this.rows = 2;
            this.cols = 20;
            this.charCounter = false;
        }
        /** @soyTemplate */
        render() {
            const shouldRenderCharCounter = this.charCounter && this.maxLength !== -1;
            const shouldRenderInternalCharCounter = shouldRenderCharCounter && this.charCounter === 'internal';
            const shouldRenderExternalCharCounter = shouldRenderCharCounter && !shouldRenderInternalCharCounter;
            const shouldRenderHelperText = !!this.helper || !!this.validationMessage ||
                shouldRenderExternalCharCounter;
            /** @classMap */
            const classes = {
                'mdc-text-field--disabled': this.disabled,
                'mdc-text-field--no-label': !this.label,
                'mdc-text-field--filled': !this.outlined,
                'mdc-text-field--outlined': this.outlined,
                'mdc-text-field--end-aligned': this.endAligned,
                'mdc-text-field--with-internal-counter': shouldRenderInternalCharCounter,
            };
            return y `
      <label class="mdc-text-field mdc-text-field--textarea ${o(classes)}">
        ${this.renderRipple()}
        ${this.outlined ? this.renderOutline() : this.renderLabel()}
        ${this.renderInput()}
        ${this.renderCharCounter(shouldRenderInternalCharCounter)}
        ${this.renderLineRipple()}
      </label>
      ${this.renderHelperText(shouldRenderHelperText, shouldRenderExternalCharCounter)}
    `;
        }
        /** @soyTemplate */
        renderInput() {
            const ariaLabelledbyOrUndef = !!this.label ? 'label' : undefined;
            const minOrUndef = this.minLength === -1 ? undefined : this.minLength;
            const maxOrUndef = this.maxLength === -1 ? undefined : this.maxLength;
            const autocapitalizeOrUndef = this.autocapitalize ?
                this.autocapitalize :
                undefined;
            return y `
      <textarea
          aria-labelledby=${l$1(ariaLabelledbyOrUndef)}
          class="mdc-text-field__input"
          .value="${l(this.value)}"
          rows="${this.rows}"
          cols="${this.cols}"
          ?disabled="${this.disabled}"
          placeholder="${this.placeholder}"
          ?required="${this.required}"
          ?readonly="${this.readOnly}"
          minlength="${l$1(minOrUndef)}"
          maxlength="${l$1(maxOrUndef)}"
          name="${l$1(this.name === '' ? undefined : this.name)}"
          inputmode="${l$1(this.inputMode)}"
          autocapitalize="${l$1(autocapitalizeOrUndef)}"
          @input="${this.handleInputChange}"
          @blur="${this.onInputBlur}">
      </textarea>`;
        }
    }
    __decorate$3([
        i$4('textarea')
    ], TextAreaBase.prototype, "formElement", void 0);
    __decorate$3([
        e$9({ type: Number })
    ], TextAreaBase.prototype, "rows", void 0);
    __decorate$3([
        e$9({ type: Number })
    ], TextAreaBase.prototype, "cols", void 0);
    __decorate$3([
        e$9({ converter: booleanOrStringConverter })
    ], TextAreaBase.prototype, "charCounter", void 0);

    /**
     * @license
     * Copyright 2021 Google LLC
     * SPDX-LIcense-Identifier: Apache-2.0
     */
    const styles = i$2 `.mdc-text-field{height:100%}.mdc-text-field__input{resize:none}`;

    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    /** @soyCompatible */
    let TextArea = class TextArea extends TextAreaBase {
    };
    TextArea.styles = [styles$2, styles];
    TextArea = __decorate$3([
        e$a('mwc-textarea')
    ], TextArea);

    /* src/main/logic/CreateNote.svelte generated by Svelte v3.52.0 */
    const file$1 = "src/main/logic/CreateNote.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let span;
    	let t1;
    	let mwc_textarea;
    	let t2;
    	let mwc_button;
    	let mwc_button_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			span.textContent = "Create Note";
    			t1 = space();
    			mwc_textarea = element("mwc-textarea");
    			t2 = space();
    			mwc_button = element("mwc-button");
    			set_style(span, "font-size", "18px");
    			add_location(span, file$1, 28, 2, 980);
    			set_custom_element_data(mwc_textarea, "outlined", "");
    			set_custom_element_data(mwc_textarea, "label", "");
    			add_location(mwc_textarea, file$1, 30, 4, 1034);
    			set_custom_element_data(mwc_button, "label", "Create Note");
    			set_custom_element_data(mwc_button, "disabled", mwc_button_disabled_value = !/*text*/ ctx[0]);
    			add_location(mwc_button, file$1, 32, 2, 1125);
    			set_style(div, "display", "flex");
    			set_style(div, "flex-direction", "column");
    			add_location(div, file$1, 27, 0, 926);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(div, t1);
    			append_dev(div, mwc_textarea);
    			append_dev(div, t2);
    			append_dev(div, mwc_button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(mwc_textarea, "input", /*input_handler*/ ctx[2], false, false, false),
    					listen_dev(mwc_button, "click", /*click_handler*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*text*/ 1 && mwc_button_disabled_value !== (mwc_button_disabled_value = !/*text*/ ctx[0])) {
    				set_custom_element_data(mwc_button, "disabled", mwc_button_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CreateNote', slots, []);
    	let appInfo = getContext(appInfoContext).getAppInfo();
    	let appWebsocket = getContext(appWebsocketContext).getAppWebsocket();
    	const dispatch = createEventDispatcher();
    	let text;

    	async function createNote() {
    		const cellData = appInfo.cell_data.find(c => c.role_id === 'main');
    		const note = { text };

    		const record = await appWebsocket.callZome({
    			cap_secret: null,
    			cell_id: cellData.cell_id,
    			zome_name: 'logic',
    			fn_name: 'create_note',
    			payload: note,
    			provenance: cellData.cell_id[1]
    		});

    		dispatch('note-created', {
    			actionHash: record.signed_action.hashed.hash
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CreateNote> was created with unknown prop '${key}'`);
    	});

    	const input_handler = e => $$invalidate(0, text = e.target.value);
    	const click_handler = () => createNote();

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		getContext,
    		appWebsocketContext,
    		appInfoContext,
    		appInfo,
    		appWebsocket,
    		dispatch,
    		text,
    		createNote
    	});

    	$$self.$inject_state = $$props => {
    		if ('appInfo' in $$props) appInfo = $$props.appInfo;
    		if ('appWebsocket' in $$props) appWebsocket = $$props.appWebsocket;
    		if ('text' in $$props) $$invalidate(0, text = $$props.text);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*text*/ 1) ;
    	};

    	return [text, createNote, input_handler, click_handler];
    }

    class CreateNote extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CreateNote",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.52.0 */
    const file = "src/App.svelte";

    // (32:2) {:else}
    function create_else_block(ctx) {
    	let div;
    	let router;
    	let current;

    	router = new Router$1({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(router.$$.fragment);
    			attr_dev(div, "id", "content");
    			add_location(div, file, 32, 4, 1015);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(router, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const router_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(router);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(32:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (28:2) {#if loading}
    function create_if_block(ctx) {
    	let div;
    	let mwc_circular_progress;

    	const block = {
    		c: function create() {
    			div = element("div");
    			mwc_circular_progress = element("mwc-circular-progress");
    			set_custom_element_data(mwc_circular_progress, "indeterminate", "");
    			add_location(mwc_circular_progress, file, 29, 6, 950);
    			set_style(div, "display", "flex");
    			set_style(div, "flex", "1");
    			set_style(div, "align-items", "center");
    			set_style(div, "justify-content", "center");
    			add_location(div, file, 28, 4, 861);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, mwc_circular_progress);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(28:2) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (39:12) <Link to="/">
    function create_default_slot_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Home");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(39:12) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (40:12) <Link to="/new-note">
    function create_default_slot_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("New Note");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(40:12) <Link to=\\\"/new-note\\\">",
    		ctx
    	});

    	return block;
    }

    // (44:8) <Route path="/">
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Main");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(44:8) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (35:6) <Router>
    function create_default_slot(ctx) {
    	let header;
    	let h1;
    	let t1;
    	let nav;
    	let link0;
    	let t2;
    	let link1;
    	let t3;
    	let route0;
    	let t4;
    	let route1;
    	let current;

    	link0 = new Link$1({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	link1 = new Link$1({
    			props: {
    				to: "/new-note",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route0 = new Route$1({
    			props: { path: "/new-note", component: CreateNote },
    			$$inline: true
    		});

    	route1 = new Route$1({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "NoteSeeker";
    			t1 = space();
    			nav = element("nav");
    			create_component(link0.$$.fragment);
    			t2 = space();
    			create_component(link1.$$.fragment);
    			t3 = space();
    			create_component(route0.$$.fragment);
    			t4 = space();
    			create_component(route1.$$.fragment);
    			attr_dev(h1, "class", "svelte-1e9puaw");
    			add_location(h1, file, 36, 10, 1078);
    			add_location(nav, file, 37, 10, 1108);
    			add_location(header, file, 35, 8, 1059);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(header, t1);
    			append_dev(header, nav);
    			mount_component(link0, nav, null);
    			append_dev(nav, t2);
    			mount_component(link1, nav, null);
    			insert_dev(target, t3, anchor);
    			mount_component(route0, target, anchor);
    			insert_dev(target, t4, anchor);
    			mount_component(route1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const link0_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				link0_changes.$$scope = { dirty, ctx };
    			}

    			link0.$set(link0_changes);
    			const link1_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				link1_changes.$$scope = { dirty, ctx };
    			}

    			link1.$set(link1_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 16) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link0.$$.fragment, local);
    			transition_in(link1.$$.fragment, local);
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link0.$$.fragment, local);
    			transition_out(link1.$$.fragment, local);
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			destroy_component(link0);
    			destroy_component(link1);
    			if (detaching) detach_dev(t3);
    			destroy_component(route0, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(route1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(35:6) <Router>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-1e9puaw");
    			add_location(main, file, 26, 0, 834);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let appWebsocket;
    	let appInfo;
    	let loading = true;
    	let actionHash;

    	onMount(async () => {
    		$$invalidate(1, appWebsocket = await AppWebsocket.connect(`ws://localhost:${process.env.HC_PORT}`));
    		$$invalidate(2, appInfo = await appWebsocket.appInfo({ installed_app_id: 'holo-noteseeker' }));
    		$$invalidate(0, loading = false);
    	});

    	setContext(appWebsocketContext, { getAppWebsocket: () => appWebsocket });
    	setContext(appInfoContext, { getAppInfo: () => appInfo });
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		setContext,
    		AppWebsocket,
    		Router: Router$1,
    		Route: Route$1,
    		Link: Link$1,
    		appWebsocketContext,
    		appInfoContext,
    		CreateNote,
    		appWebsocket,
    		appInfo,
    		loading,
    		actionHash
    	});

    	$$self.$inject_state = $$props => {
    		if ('appWebsocket' in $$props) $$invalidate(1, appWebsocket = $$props.appWebsocket);
    		if ('appInfo' in $$props) $$invalidate(2, appInfo = $$props.appInfo);
    		if ('loading' in $$props) $$invalidate(0, loading = $$props.loading);
    		if ('actionHash' in $$props) $$invalidate(3, actionHash = $$props.actionHash);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*appWebsocket, appInfo, loading*/ 7) ;
    	};

    	return [loading, appWebsocket, appInfo];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
