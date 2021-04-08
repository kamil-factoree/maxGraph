/**
 * Copyright (c) 2006-2015, JGraph Ltd
 * Copyright (c) 2006-2015, Gaudenz Alder
 * Updated to ES9 syntax by David Morrissey 2021
 */

import mxMouseEvent from '../../util/event/mxMouseEvent';
import mxConstants from '../../util/mxConstants';
import mxPoint from '../../util/datatypes/mxPoint';
import mxRectangle from '../../util/datatypes/mxRectangle';
import mxRectangleShape from '../../shape/node/mxRectangleShape';
import mxGraph from './mxGraph';
import mxImageShape from '../../shape/node/mxImageShape';
import mxEvent from '../../util/event/mxEvent';
import mxUtils from '../../util/mxUtils';
import mxImage from '../../util/image/mxImage';
import mxEventObject from "../../util/event/mxEventObject";

/**
 * Class: mxOutline
 *
 * Implements an outline (aka overview) for a graph. Set <updateOnPan> to true
 * to enable updates while the source graph is panning.
 *
 * Example:
 *
 * (code)
 * let outline = new mxOutline(graph, div);
 * (end)
 *
 * To move the graph to the top, left corner the following code can be used.
 *
 * (code)
 * let scale = graph.view.scale;
 * let bounds = graph.getGraphBounds();
 * graph.view.setTranslate(-bounds.x / scale, -bounds.y / scale);
 * (end)
 *
 * To toggle the suspended mode, the following can be used.
 *
 * (code)
 * outline.suspended = !outln.suspended;
 * if (!outline.suspended)
 * {
 *   outline.update(true);
 * }
 * (end)
 *
 * Constructor: mxOutline
 *
 * Constructs a new outline for the specified graph inside the given
 * container.
 *
 * Parameters:
 *
 * source - <mxGraph> to create the outline for.
 * container - DOM node that will contain the outline.
 */
class mxOutline {
  constructor(source: mxGraph, container: HTMLElement | null = null) {
    this.source = source;

    if (container != null) {
      this.init(container);
    }
  }

  /**
   * Function: init
   *
   * Initializes the outline inside the given container.
   */
  init(container: HTMLElement) {
    this.outline = this.createGraph(container);

    // Do not repaint when suspended
    const outlineGraphModelChanged = this.outline.graphModelChanged;
    this.outline.graphModelChanged = mxUtils.bind(this, (changes: any) => {
      if (!this.suspended && this.outline != null) {
        outlineGraphModelChanged.apply(this.outline, [changes]);
      }
    });

    // Enable faster painting in SVG
    //const node = <SVGElement>this.outline.getView().getCanvas().parentNode;
    //node.setAttribute('shape-rendering', 'optimizeSpeed');
    //node.setAttribute('image-rendering', 'optimizeSpeed');

    // Hides cursors and labels
    this.outline.labelsVisible = this.labelsVisible;
    this.outline.setEnabled(false);

    this.updateHandler = (sender: any, evt: mxEventObject) => {
      if (!this.suspended && !this.active) {
        this.update();
      }
    };

    // Updates the scale of the outline after a change of the main graph
    this.source.getModel().addListener(mxEvent.CHANGE, this.updateHandler);
    this.outline.addMouseListener(this);

    // Adds listeners to keep the outline in sync with the source graph
    const view = this.source.getView();
    view.addListener(mxEvent.SCALE, this.updateHandler);
    view.addListener(mxEvent.TRANSLATE, this.updateHandler);
    view.addListener(mxEvent.SCALE_AND_TRANSLATE, this.updateHandler);
    view.addListener(mxEvent.DOWN, this.updateHandler);
    view.addListener(mxEvent.UP, this.updateHandler);

    // Updates blue rectangle on scroll
    mxEvent.addListener(this.source.container, 'scroll', this.updateHandler);

    this.panHandler = (sender: any, evt: mxEventObject) => {
      if (this.updateOnPan) {
        (<Function>this.updateHandler)(sender, evt);
      }
    };
    this.source.addListener(mxEvent.PAN, this.panHandler);

    // Refreshes the graph in the outline after a refresh of the main graph
    this.refreshHandler = (sender: any) => {
      const outline = <mxGraph>this.outline;
      outline.setStylesheet(this.source.getStylesheet());
      outline.refresh();
    };
    this.source.addListener(mxEvent.REFRESH, this.refreshHandler);

    // Creates the blue rectangle for the viewport
    this.bounds = new mxRectangle(0, 0, 0, 0);
    this.selectionBorder = new mxRectangleShape(
        this.bounds,
        null,
        mxConstants.OUTLINE_COLOR,
        mxConstants.OUTLINE_STROKEWIDTH
    );
    this.selectionBorder.dialect = this.outline.dialect;
    this.selectionBorder.init(this.outline.getView().getOverlayPane());
    const selectionBorderNode = <SVGGElement>this.selectionBorder.node;

    // Handles event by catching the initial pointer start and then listening to the
    // complete gesture on the event target. This is needed because all the events
    // are routed via the initial element even if that element is removed from the
    // DOM, which happens when we repaint the selection border and zoom handles.
    const handler = (evt: Event) => {
      const t = mxEvent.getSource(evt);

      const redirect = (evt: Event) => {
        const outline = <mxGraph>this.outline;
        outline.fireMouseEvent(mxEvent.MOUSE_MOVE, new mxMouseEvent(evt));
      };

      var redirect2 = (evt: Event) => {
        const outline = <mxGraph>this.outline;
        mxEvent.removeGestureListeners(t, null, redirect, redirect2);
        outline.fireMouseEvent(mxEvent.MOUSE_UP, new mxMouseEvent(evt));
      };

      const outline = <mxGraph>this.outline;
      mxEvent.addGestureListeners(t, null, redirect, redirect2);
      outline.fireMouseEvent(mxEvent.MOUSE_DOWN, new mxMouseEvent(evt));
    };

    mxEvent.addGestureListeners(this.selectionBorder.node, handler);

    // Creates a small blue rectangle for sizing (sizer handle)
    const sizer = this.sizer = this.createSizer();
    const sizerNode = <SVGGElement>sizer.node;

    sizer.init(this.outline.getView().getOverlayPane());

    if (this.enabled) {
      sizerNode.style.cursor = 'nwse-resize';
    }

    mxEvent.addGestureListeners(this.sizer.node, handler);

    selectionBorderNode.style.display = this.showViewport ? '' : 'none';
    sizerNode.style.display = selectionBorderNode.style.display;
    selectionBorderNode.style.cursor = 'move';

    this.update(false);
  }

  // TODO: Document me!!
  sizer: mxRectangleShape | null=null;

  selectionBorder: mxRectangleShape | null=null;

  updateHandler: Function | null=null;

  refreshHandler: Function | null=null;

  panHandler: Function | null=null;

  active: boolean | null=null;

  bounds: mxRectangle | null=null;

  zoom: boolean=false;

  startX: number | null=null;

  startY: number | null=null;

  dx0: number | null=null;

  dy0: number | null=null;

  index: number | null=null;

  /**
   * Function: source
   *
   * Reference to the source <mxGraph>.
   */
  source: mxGraph;

  /**
   * Function: outline
   *
   * Reference to the <mxGraph> that renders the outline.
   */
  outline: mxGraph | null=null;

  /**
   * Function: graphRenderHint
   *
   * Renderhint to be used for the outline graph. Default is exact.
   */
  graphRenderHint: string = 'exact';

  /**
   * Variable: enabled
   *
   * Specifies if events are handled. Default is true.
   */
  enabled: boolean = true;

  /**
   * Variable: showViewport
   *
   * Specifies a viewport rectangle should be shown. Default is true.
   */
  showViewport: boolean = true;

  /**
   * Variable: border
   *
   * Border to be added at the bottom and right. Default is 10.
   */
  border: number = 10;

  /**
   * Variable: enabled
   *
   * Specifies the size of the sizer handler. Default is 8.
   */
  sizerSize: number = 8;

  /**
   * Variable: labelsVisible
   *
   * Specifies if labels should be visible in the outline. Default is false.
   */
  labelsVisible: boolean = false;

  /**
   * Variable: updateOnPan
   *
   * Specifies if <update> should be called for <mxEvent.PAN> in the source
   * graph. Default is false.
   */
  updateOnPan: boolean = false;

  /**
   * Variable: sizerImage
   *
   * Optional <mxImage> to be used for the sizer. Default is null.
   */
  sizerImage: mxImage | null = null;

  /**
   * Variable: minScale
   *
   * Minimum scale to be used. Default is 0.0001.
   */
  minScale: number = 0.0001;

  /**
   * Variable: suspended
   *
   * Optional boolean flag to suspend updates. Default is false. This flag will
   * also suspend repaints of the outline. To toggle this switch, use the
   * following code.
   *
   * (code)
   * nav.suspended = !nav.suspended;
   *
   * if (!nav.suspended)
   * {
   *   nav.update(true);
   * }
   * (end)
   */
  suspended: boolean = false;

  /**
   * Function: createGraph
   *
   * Creates the <mxGraph> used in the outline.
   */
  createGraph(container: HTMLElement): mxGraph {
    const graph = new mxGraph(
      container,
      this.source.getModel(),
      this.graphRenderHint,
      this.source.getStylesheet()
    );
    graph.foldingEnabled = false;
    graph.autoScroll = false;
    return graph;
  }

  /**
   * Function: isEnabled
   *
   * Returns true if events are handled. This implementation
   * returns <enabled>.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Function: setEnabled
   *
   * Enables or disables event handling. This implementation
   * updates <enabled>.
   *
   * Parameters:
   *
   * value - Boolean that specifies the new enabled state.
   */
  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  /**
   * Function: setZoomEnabled
   *
   * Enables or disables the zoom handling by showing or hiding the respective
   * handle.
   *
   * Parameters:
   *
   * value - Boolean that specifies the new enabled state.
   */
  setZoomEnabled(value: boolean): void {
    // @ts-ignore
    this.sizer.node.style.visibility = value ? 'visible' : 'hidden';
  }

  /**
   * Function: refresh
   *
   * Invokes <update> and revalidate the outline. This method is deprecated.
   */
  refresh(): void {
    this.update(true);
  }

  /**
   * Function: createSizer
   *
   * Creates the shape used as the sizer.
   */
  createSizer(): mxRectangleShape {
    const outline = <mxGraph>this.outline;
    if (this.sizerImage != null) {
      const sizer = new mxImageShape(
        new mxRectangle(0, 0, this.sizerImage.width, this.sizerImage.height),
        this.sizerImage.src
      );
      sizer.dialect = outline.dialect;
      return sizer;
    }

    const sizer = new mxRectangleShape(
      new mxRectangle(0, 0, this.sizerSize, this.sizerSize),
      mxConstants.OUTLINE_HANDLE_FILLCOLOR,
      mxConstants.OUTLINE_HANDLE_STROKECOLOR
    );
    sizer.dialect = outline.dialect;
    return sizer;
  }

  /**
   * Function: getSourceContainerSize
   *
   * Returns the size of the source container.
   */
  getSourceContainerSize() {
    return new mxRectangle(
      0,
      0,
      (<HTMLElement>this.source.container).scrollWidth,
      (<HTMLElement>this.source.container).scrollHeight
    );
  }

  /**
   * Function: getOutlineOffset
   *
   * Returns the offset for drawing the outline graph.
   */
  getOutlineOffset(scale: number): mxPoint | null {  // TODO: Should number -> mxPoint?
    return null;
  }

  /**
   * Function: getSourceGraphBounds
   *
   * Returns the graph bound boxing of the source.
   */
  getSourceGraphBounds() {
    return this.source.getGraphBounds();
  }

  /**
   * Function: update
   *
   * Updates the outline.
   */
  update(revalidate: boolean = false) {
    if (
      this.source != null &&
      this.source.container != null &&
      this.outline != null &&
      this.outline.container != null
    ) {
      const sourceScale = this.source.view.scale;
      const scaledGraphBounds = this.getSourceGraphBounds();
      const unscaledGraphBounds = new mxRectangle(
        scaledGraphBounds.x / sourceScale + this.source.panDx,
        scaledGraphBounds.y / sourceScale + this.source.panDy,
        scaledGraphBounds.width / sourceScale,
        scaledGraphBounds.height / sourceScale
      );

      const unscaledFinderBounds = new mxRectangle(
        0,
        0,
        this.source.container.clientWidth / sourceScale,
        this.source.container.clientHeight / sourceScale
      );

      const union = unscaledGraphBounds.clone();
      union.add(unscaledFinderBounds);

      // Zooms to the scrollable area if that is bigger than the graph
      const size = this.getSourceContainerSize();
      const completeWidth = Math.max(size.width / sourceScale, union.width);
      const completeHeight = Math.max(size.height / sourceScale, union.height);

      const availableWidth = Math.max(
        0,
        this.outline.container.clientWidth - this.border
      );
      const availableHeight = Math.max(
        0,
        this.outline.container.clientHeight - this.border
      );

      const outlineScale = Math.min(
        availableWidth / completeWidth,
        availableHeight / completeHeight
      );
      let scale = Number.isNaN(outlineScale)
        ? this.minScale
        : Math.max(this.minScale, outlineScale);

      if (scale > 0) {
        if (this.outline.getView().scale !== scale) {
          this.outline.getView().scale = scale;
          revalidate = true;
        }

        const navView = this.outline.getView();

        if (navView.currentRoot !== this.source.getView().currentRoot) {
          navView.setCurrentRoot(this.source.getView().currentRoot);
        }

        const t = this.source.view.translate;
        let tx = t.x + this.source.panDx;
        let ty = t.y + this.source.panDy;

        const off = this.getOutlineOffset(scale);

        if (off != null) {
          tx += off.x;
          ty += off.y;
        }

        if (unscaledGraphBounds.x < 0) {
          tx -= unscaledGraphBounds.x;
        }
        if (unscaledGraphBounds.y < 0) {
          ty -= unscaledGraphBounds.y;
        }

        if (navView.translate.x !== tx || navView.translate.y !== ty) {
          navView.translate.x = tx;
          navView.translate.y = ty;
          revalidate = true;
        }

        // Prepares local variables for computations
        const t2 = navView.translate;
        scale = this.source.getView().scale;
        const scale2 = scale / navView.scale;
        const scale3 = 1.0 / navView.scale;
        const { container } = this.source;

        // Updates the bounds of the viewrect in the navigation
        this.bounds = new mxRectangle(
          (t2.x - t.x - this.source.panDx) / scale3,
          (t2.y - t.y - this.source.panDy) / scale3,
          container.clientWidth / scale2,
          container.clientHeight / scale2
        );

        // Adds the scrollbar offset to the finder
        this.bounds.x +=
          (this.source.container.scrollLeft * navView.scale) / scale;
        this.bounds.y +=
          (this.source.container.scrollTop * navView.scale) / scale;

        const selectionBorder = <mxRectangleShape>this.selectionBorder;
        let b = <mxRectangle>selectionBorder.bounds;

        if (
          b.x !== this.bounds.x ||
          b.y !== this.bounds.y ||
          b.width !== this.bounds.width ||
          b.height !== this.bounds.height
        ) {
          selectionBorder.bounds = this.bounds;
          selectionBorder.redraw();
        }

        // Updates the bounds of the zoom handle at the bottom right
        const sizer = <mxRectangleShape>this.sizer;
        b = <mxRectangle>sizer.bounds;
        const b2 = new mxRectangle(
          this.bounds.x + this.bounds.width - b.width / 2,
          this.bounds.y + this.bounds.height - b.height / 2,
          b.width,
          b.height
        );

        if (
          b.x !== b2.x ||
          b.y !== b2.y ||
          b.width !== b2.width ||
          b.height !== b2.height
        ) {
          sizer.bounds = b2;

          // Avoids update of visibility in redraw for VML
          if ((<SVGGElement>sizer.node).style.visibility !== 'hidden') {
            sizer.redraw();
          }
        }

        if (revalidate) {
          this.outline.view.revalidate();
        }
      }
    }
  }

  /**
   * Function: mouseDown
   *
   * Handles the event by starting a translation or zoom.
   */
  mouseDown(sender: any, me: mxMouseEvent) {
    if (this.enabled && this.showViewport) {
      const tol = !mxEvent.isMouseEvent(me.getEvent())
        ? this.source.tolerance
        : 0;
      const hit =
        tol > 0
          ? new mxRectangle(
              me.getGraphX() - tol,
              me.getGraphY() - tol,
              2 * tol,
              2 * tol
            )
          : null;
      this.zoom =
        me.isSource(this.sizer) ||
        (hit != null && mxUtils.intersects(shape.bounds, hit));
      this.startX = me.getX();
      this.startY = me.getY();
      this.active = true;
      const sourceContainer = <HTMLElement>this.source.container;

      if (
        this.source.useScrollbarsForPanning &&
        mxUtils.hasScrollbars(this.source.container)
      ) {
        this.dx0 = sourceContainer.scrollLeft;
        this.dy0 = sourceContainer.scrollTop;
      } else {
        this.dx0 = 0;
        this.dy0 = 0;
      }
    }

    me.consume();
  }

  /**
   * Function: mouseMove
   *
   * Handles the event by previewing the viewrect in <graph> and updating the
   * rectangle that represents the viewrect in the outline.
   */
  mouseMove(sender: any, me: mxMouseEvent) {
    if (this.active) {
      const myBounds = <mxRectangle>this.bounds;
      const sizer = <mxRectangleShape>this.sizer;
      const sizerNode = <SVGGElement>sizer.node;
      const selectionBorder = <mxRectangleShape>this.selectionBorder;
      const selectionBorderNode = <SVGGElement>selectionBorder.node;
      const source = <mxGraph>this.source;
      const outline = <mxGraph>this.outline;

      selectionBorderNode.style.display = this.showViewport ? '' : 'none';
      sizerNode.style.display = selectionBorderNode.style.display;

      const delta = this.getTranslateForEvent(me);
      let dx = delta.x;
      let dy = delta.y;
      let bounds = null;

      if (!this.zoom) {
        // Previews the panning on the source graph
        const { scale } = outline.getView();
        bounds = new mxRectangle(
            myBounds.x + dx,
            myBounds.y + dy,
            myBounds.width,
            myBounds.height
        );
        selectionBorder.bounds = bounds;
        selectionBorder.redraw();
        dx /= scale;
        dx *= source.getView().scale;
        dy /= scale;
        dy *= source.getView().scale;
        source.panGraph(-dx - <number>this.dx0, -dy - <number>this.dy0);
      } else {
        // Does *not* preview zooming on the source graph
        const { container } = <mxGraph>this.source;
        // @ts-ignore
        const viewRatio = container.clientWidth / container.clientHeight;
        dy = dx / viewRatio;
        bounds = new mxRectangle(
            myBounds.x,
            myBounds.y,
          Math.max(1, myBounds.width + dx),
          Math.max(1, myBounds.height + dy)
        );
        selectionBorder.bounds = bounds;
        selectionBorder.redraw();
      }

      // Updates the zoom handle
      const b = <mxRectangle>sizer.bounds;
      sizer.bounds = new mxRectangle(
        bounds.x + bounds.width - b.width / 2,
        bounds.y + bounds.height - b.height / 2,
        b.width,
        b.height
      );

      // Avoids update of visibility in redraw for VML
      if (sizerNode.style.visibility !== 'hidden') {
        sizer.redraw();
      }
      me.consume();
    }
  }

  /**
   * Function: getTranslateForEvent
   *
   * Gets the translate for the given mouse event. Here is an example to limit
   * the outline to stay within positive coordinates:
   *
   * (code)
   * outline.getTranslateForEvent = (me)=>
   * {
   *   let pt = new mxPoint(me.getX() - this.startX, me.getY() - this.startY);
   *
   *   if (!this.zoom)
   *   {
   *     let tr = this.source.view.translate;
   *     pt.x = Math.max(tr.x * this.outline.view.scale, pt.x);
   *     pt.y = Math.max(tr.y * this.outline.view.scale, pt.y);
   *   }
   *
   *   return pt;
   * };
   * (end)
   */
  getTranslateForEvent(me: mxMouseEvent) {
    return new mxPoint(me.getX() - <number>this.startX, me.getY() - <number>this.startY);
  }

  /**
   * Function: mouseUp
   *
   * Handles the event by applying the translation or zoom to <graph>.
   */
  mouseUp(sender: any, me: mxMouseEvent) {
    if (this.active) {
      const delta = this.getTranslateForEvent(me);
      let dx = delta.x;
      let dy = delta.y;
      const source = <mxGraph>this.source;
      const outline = <mxGraph>this.outline;
      const selectionBorder = <mxRectangleShape>this.selectionBorder;

      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        if (!this.zoom) {
          // Applies the new translation if the source
          // has no scrollbars
          if (
            !source.useScrollbarsForPanning ||
            !mxUtils.hasScrollbars(source.container)
          ) {
            source.panGraph(0, 0);
            dx /= outline.getView().scale;
            dy /= outline.getView().scale;
            const t = source.getView().translate;
            source.getView().setTranslate(t.x - dx, t.y - dy);
          }
        } else {
          // Applies the new zoom
          const w = (<mxRectangle>selectionBorder.bounds).width;
          const { scale } = source.getView();
          source.zoomTo(
            Math.max(this.minScale, scale - (dx * scale) / w),
            false
          );
        }

        this.update();
        me.consume();
      }

      // Resets the state of the handler
      this.index = null;
      this.active = false;
    }
  }

  /**
   * Function: destroy
   *
   * Destroy this outline and removes all listeners from <source>.
   */
  destroy() {
    if (this.source != null) {
      this.source.removeListener(this.panHandler);
      this.source.removeListener(this.refreshHandler);
      this.source.getModel().removeListener(this.updateHandler);
      this.source.getView().removeListener(this.updateHandler);
      mxEvent.removeListener(
        this.source.container,
        'scroll',
        this.updateHandler
      );
      // @ts-ignore
      this.source = null;
    }

    if (this.outline != null) {
      this.outline.removeMouseListener(this);
      this.outline.destroy();
      this.outline = null;
    }

    if (this.selectionBorder != null) {
      this.selectionBorder.destroy();
      this.selectionBorder = null;
    }

    if (this.sizer != null) {
      this.sizer.destroy();
      this.sizer = null;
    }
  }
}

export default mxOutline;
