/**
 * Copyright (c) 2006-2015, JGraph Ltd
 * Copyright (c) 2006-2015, Gaudenz Alder
 * Updated to ES9 syntax by David Morrissey 2021
 */

import mxUndoableEdit from '../../util/undo/mxUndoableEdit';
import mxEventSource from '../../util/event/mxEventSource';
import mxEventObject from '../../util/event/mxEventObject';
import mxClient from '../../mxClient';
import mxUtils from '../../util/mxUtils';
import mxSelectionChange from './mxSelectionChange';
import mxEvent from '../../util/event/mxEvent';
import mxCell from '../cell/mxCell';
import mxGraph from './mxGraph';

class mxGraphSelectionModel extends mxEventSource {
  // TODO: Document me!!
  cells: mxCell[];

  /**
   * Variable: doneResource
   *
   * Specifies the resource key for the status message after a long operation.
   * If the resource for this key does not exist then the value is used as
   * the status message. Default is 'done'.
   */
  doneResource: string = mxClient.language !== 'none' ? 'done' : '';

  /**
   * Variable: updatingSelectionResource
   *
   * Specifies the resource key for the status message while the selection is
   * being updated. If the resource for this key does not exist then the
   * value is used as the status message. Default is 'updatingSelection'.
   */
  updatingSelectionResource: string =
    mxClient.language !== 'none' ? 'updatingSelection' : '';

  /**
   * Variable: graph
   *
   * Reference to the enclosing <mxGraph>.
   */
  graph: mxGraph | null = null;

  /**
   * Variable: singleSelection
   *
   * Specifies if only one selected item at a time is allowed.
   * Default is false.
   */
  singleSelection: boolean = false;

  /**
   * Class: mxGraphSelectionModel
   *
   * Implements the selection model for a graph. Here is a listener that handles
   * all removed selection cells.
   *
   * (code)
   * graph.getSelectionModel().addListener(mxEvent.CHANGE, (sender, evt)=>
   * {
   *   let cells = evt.getProperty('added');
   *
   *   for (let i = 0; i < cells.length; i += 1)
   *   {
   *     // Handle cells[i]...
   *   }
   * });
   * (end)
   *
   * Event: mxEvent.UNDO
   *
   * Fires after the selection was changed in <changeSelection>. The
   * <code>edit</code> property contains the <mxUndoableEdit> which contains the
   * <mxSelectionChange>.
   *
   * Event: mxEvent.CHANGE
   *
   * Fires after the selection changes by executing an <mxSelectionChange>. The
   * <code>added</code> and <code>removed</code> properties contain arrays of
   * cells that have been added to or removed from the selection, respectively.
   * The names are inverted due to historic reasons. This cannot be changed.
   *
   * Constructor: mxGraphSelectionModel
   *
   * Constructs a new graph selection model for the given <mxGraph>.
   *
   * Parameters:
   *
   * graph - Reference to the enclosing <mxGraph>.
   */
  constructor(graph: mxGraph) {
    super();

    this.graph = graph;
    this.cells = [];
  }

  /**
   * Function: isSingleSelection
   *
   * Returns <singleSelection> as a boolean.
   */
  isSingleSelection(): boolean {
    return this.singleSelection;
  }

  /**
   * Function: setSingleSelection
   *
   * Sets the <singleSelection> flag.
   *
   * Parameters:
   *
   * singleSelection - Boolean that specifies the new value for
   * <singleSelection>.
   */
  setSingleSelection(singleSelection: boolean): void {
    this.singleSelection = singleSelection;
  }

  /**
   * Function: isSelected
   *
   * Returns true if the given <mxCell> is selected.
   */
  isSelected(cell: mxCell): boolean {
    if (cell != null) {
      return mxUtils.indexOf(this.cells, cell) >= 0;
    }
    return false;
  }

  /**
   * Function: isEmpty
   *
   * Returns true if no cells are currently selected.
   */
  isEmpty(): boolean {
    return this.cells.length === 0;
  }

  /**
   * Function: clear
   *
   * Clears the selection and fires a <change> event if the selection was not
   * empty.
   */
  clear(): void {
    this.changeSelection(null, this.cells);
  }

  /**
   * Function: setCell
   *
   * Selects the specified <mxCell> using <setCells>.
   *
   * Parameters:
   *
   * cell - <mxCell> to be selected.
   */
  setCell(cell: mxCell | null): void {
    if (cell != null) {
      this.setCells([cell]);
    }
  }

  /**
   * Function: setCells
   *
   * Selects the given array of <mxCells> and fires a <change> event.
   *
   * Parameters:
   *
   * cells - Array of <mxCells> to be selected.
   */
  setCells(cells: mxCell[]): void {
    if (cells != null) {
      if (this.singleSelection) {
        cells = [<mxCell>this.getFirstSelectableCell(cells)];
      }

      const tmp = [];
      for (let i = 0; i < cells.length; i += 1) {
        if ((<mxGraph>this.graph).isCellSelectable(cells[i])) {
          tmp.push(cells[i]);
        }
      }
      this.changeSelection(tmp, this.cells);
    }
  }

  /**
   * Function: getFirstSelectableCell
   *
   * Returns the first selectable cell in the given array of cells.
   */
  getFirstSelectableCell(cells: mxCell[]): mxCell | null {
    if (cells != null) {
      for (let i = 0; i < cells.length; i += 1) {
        if ((<mxGraph>this.graph).isCellSelectable(cells[i])) {
          return cells[i];
        }
      }
    }
    return null;
  }

  /**
   * Function: addCell
   *
   * Adds the given <mxCell> to the selection and fires a <select> event.
   *
   * Parameters:
   *
   * cell - <mxCell> to add to the selection.
   */
  addCell(cell: mxCell | null = null): void {
    if (cell != null) {
      this.addCells([cell]);
    }
  }

  /**
   * Function: addCells
   *
   * Adds the given array of <mxCells> to the selection and fires a <select>
   * event.
   *
   * Parameters:
   *
   * cells - Array of <mxCells> to add to the selection.
   */
  addCells(cells: mxCell[]): void {
    if (cells != null) {
      let remove = null;
      if (this.singleSelection) {
        remove = this.cells;
        cells = [<mxCell>this.getFirstSelectableCell(cells)];
      }

      const tmp = [];
      for (let i = 0; i < cells.length; i += 1) {
        if (
          !this.isSelected(cells[i]) &&
          (<mxGraph>this.graph).isCellSelectable(cells[i])
        ) {
          tmp.push(cells[i]);
        }
      }

      this.changeSelection(tmp, remove);
    }
  }

  /**
   * Function: removeCell
   *
   * Removes the specified <mxCell> from the selection and fires a <select>
   * event for the remaining cells.
   *
   * Parameters:
   *
   * cell - <mxCell> to remove from the selection.
   */
  removeCell(cell: mxCell | null = null): void {
    if (cell != null) {
      this.removeCells([cell]);
    }
  }

  /**
   * Function: removeCells
   */
  removeCells(cells: mxCell[] | null = null): void {
    if (cells != null) {
      const tmp = [];
      for (let i = 0; i < cells.length; i += 1) {
        if (this.isSelected(cells[i])) {
          tmp.push(cells[i]);
        }
      }
      this.changeSelection(null, tmp);
    }
  }

  /**
   * Function: changeSelection
   *
   * Adds/removes the specified arrays of <mxCell> to/from the selection.
   *
   * Parameters:
   *
   * added - Array of <mxCell> to add to the selection.
   * remove - Array of <mxCell> to remove from the selection.
   */
  changeSelection(added: mxCell[] | null=null,
                  removed: mxCell[] | null=null): void {
    if (
      (added != null && added.length > 0 && added[0] != null) ||
      (removed != null && removed.length > 0 && removed[0] != null)
    ) {
      const change = new mxSelectionChange(this, added || [], removed || []);
      change.execute();
      const edit = new mxUndoableEdit(this, false);
      edit.add(change);
      this.fireEvent(new mxEventObject(mxEvent.UNDO, 'edit', edit));
    }
  }

  /**
   * Function: cellAdded
   *
   * Inner callback to add the specified <mxCell> to the selection. No event
   * is fired in this implementation.
   *
   * Paramters:
   *
   * cell - <mxCell> to add to the selection.
   */
  cellAdded(cell: mxCell): void {
    if (cell != null && !this.isSelected(cell)) {
      this.cells.push(cell);
    }
  }

  /**
   * Function: cellRemoved
   *
   * Inner callback to remove the specified <mxCell> from the selection. No
   * event is fired in this implementation.
   *
   * Parameters:
   *
   * cell - <mxCell> to remove from the selection.
   */
  cellRemoved(cell: mxCell): void {
    if (cell != null) {
      const index = mxUtils.indexOf(this.cells, cell);
      if (index >= 0) {
        this.cells.splice(index, 1);
      }
    }
  }
}

export default mxGraphSelectionModel;
