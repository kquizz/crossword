import { Controller, outlets } from "stimulus-x"

export default class extends outlets(Controller) {
  static outlets = ["grid-management"]

  connect() {
    this.element.addEventListener("keydown", this.handleKeydown.bind(this))
  }

  handleKeydown(event) {
    // Only handle single letter keys (A-Z)
    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault()
      const letter = event.key.toUpperCase()
      this.fillCell(letter)
      this.moveToNextCell()
    }
  }

  fillCell(letter) {
    // Fill the cell visually (could be improved to sync with backend)
    this.element.textContent = letter
    // Optionally: trigger Turbo or AJAX to persist
  }

  moveToNextCell() {
    // Use grid-management outlet to move focus
    if (this.gridManagementOutlet && typeof this.gridManagementOutlet.moveToNextCell === "function") {
      const row = parseInt(this.element.dataset.row)
      const col = parseInt(this.element.dataset.col)
      this.gridManagementOutlet.moveToNextCell(row, col)
    }
  }
}
