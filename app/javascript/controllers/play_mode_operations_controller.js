import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    mode: String,
    puzzleId: Number
  }

  connect() {
    console.log("Play Mode Operations Controller connected")
    console.log("Mode value:", this.modeValue)
    console.log("Puzzle ID value:", this.puzzleIdValue)
  }

  // Check entire puzzle for correctness
  checkPuzzle(cluesData, gridData, gridElement) {
    if (!cluesData || !gridElement) return

    let hasErrors = false
    const allClues = [...cluesData.across, ...cluesData.down]

    allClues.forEach(clue => {
      const isCorrect = this.checkClueWord(clue, false, gridData) // Don't highlight, just check
      if (!isCorrect) {
        hasErrors = true
        this.highlightIncorrectClue(clue, gridElement)
      }
    })

    if (!hasErrors) {
      this.checkForPuzzleCompletion(cluesData, gridData)
    }
  }

  // Check current word for correctness
  checkWord(selectedRow, selectedCol, cluesData, gridData, direction) {
    if (selectedRow === undefined || selectedCol === undefined || !cluesData) return

    const currentClue = this.getCurrentClueFromPosition(selectedRow, selectedCol, cluesData, direction)
    if (currentClue) {
      const isCorrect = this.checkClueWord(currentClue, true, gridData)
      if (isCorrect) {
        this.showMessage('Word is correct! ✓', 'success')
      } else {
        this.showMessage('Word has errors ✗', 'error')
      }
    }
  }

  // Reveal letter at current position
  revealLetter(selectedRow, selectedCol, cluesData, gridData, direction) {
    if (selectedRow === undefined || selectedCol === undefined || !cluesData) return

    const currentClue = this.getCurrentClueFromPosition(selectedRow, selectedCol, cluesData, direction)
    if (currentClue) {
      const letterIndex = this.getLetterIndexInWord(selectedRow, selectedCol, currentClue)
      if (letterIndex !== -1 && letterIndex < currentClue.answer.length) {
        const correctLetter = currentClue.answer[letterIndex]
        
        // Dispatch event to update cell
        const event = new CustomEvent('cell-reveal', {
          detail: { 
            row: selectedRow, 
            col: selectedCol, 
            value: correctLetter,
            message: `Revealed: ${correctLetter}`,
            messageType: 'info'
          },
          bubbles: true
        })
        this.element.dispatchEvent(event)
      }
    }
  }

  // Reveal entire current word
  revealWord(selectedRow, selectedCol, cluesData, gridData, direction) {
    if (selectedRow === undefined || selectedCol === undefined || !cluesData) return

    const currentClue = this.getCurrentClueFromPosition(selectedRow, selectedCol, cluesData, direction)
    if (currentClue) {
      if (confirm('Reveal the entire current word?')) {
        // Dispatch event to fill word
        const event = new CustomEvent('word-reveal', {
          detail: { 
            clue: currentClue,
            message: `Revealed: ${currentClue.answer}`,
            messageType: 'info'
          },
          bubbles: true
        })
        this.element.dispatchEvent(event)
      }
    }
  }

  // Check if current word is complete
  isWordComplete(row, col, cluesData, gridData, direction) {
    console.log(`Play mode controller: Checking if word is complete at (${row}, ${col}) direction: ${direction}`)
    if (!cluesData) {
      console.log('No cluesData provided')
      return false
    }

    const currentClue = this.getCurrentClueFromPosition(row, col, cluesData, direction)
    if (!currentClue) {
      console.log('No clue found at position')
      return false
    }

    console.log(`Found clue: ${currentClue.number} ${currentClue.direction} - ${currentClue.answer}`)

    // Check if all letters in the word are filled
    const wordPositions = this.getWordPositions(currentClue)
    const isComplete = wordPositions.every(({row, col}) => {
      const value = gridData[row] && gridData[row][col]
      console.log(`Position (${row}, ${col}): value="${value}"`)
      return value && value !== '#'
    })

    console.log(`Word complete result: ${isComplete}`)
    return isComplete
  }

  // Move to next unfilled word
  moveToNextUnfilledWord(cluesData, gridData, currentDirection, currentRow, currentCol) {
    console.log('Play mode controller: moveToNextUnfilledWord called with:', {
      cluesData: cluesData ? 'present' : 'null',
      gridData: gridData ? 'present' : 'null',
      currentDirection,
      currentRow,
      currentCol
    })
    
    if (!cluesData) {
      console.log('No cluesData provided to moveToNextUnfilledWord')
      return null
    }
    
    console.log(`moveToNextUnfilledWord: Looking for next unfilled word from position (${currentRow}, ${currentCol}) in direction ${currentDirection}`)

    const words = currentDirection === 'across' ? cluesData.across : cluesData.down
    
    // Find the current clue to know where we are
    const currentClue = this.getCurrentClueFromPosition(currentRow, currentCol, cluesData, currentDirection)
    console.log('Current clue:', currentClue)
    
    let foundCurrent = false
    
    for (const clue of words) {
      // If we haven't found our current position yet, keep looking
      if (!foundCurrent) {
        if (currentClue && clue.number === currentClue.number && clue.direction === currentClue.direction) {
          foundCurrent = true // Found current clue, start searching from next one
          console.log(`Found current clue: ${clue.number} ${clue.direction}`)
        }
        continue
      }
      
      // Now look for unfilled words after current position
      console.log(`Checking if clue ${clue.number} ${clue.direction} is complete:`, this.isClueWordComplete(clue, gridData))
      if (!this.isClueWordComplete(clue, gridData)) {
        const firstEmptyPos = this.getFirstEmptyPosition(clue, gridData)
        if (firstEmptyPos) {
          console.log(`Found next unfilled word: ${clue.number} ${clue.direction} at (${firstEmptyPos.row}, ${firstEmptyPos.col})`)
          return {
            row: firstEmptyPos.row,
            col: firstEmptyPos.col,
            direction: currentDirection
          }
        }
      }
    }
    
    console.log(`No more unfilled words in ${currentDirection}, trying other direction`)

    // If no unfilled words in current direction, try the other direction
    const otherDirection = currentDirection === 'across' ? 'down' : 'across'
    const otherWords = otherDirection === 'across' ? cluesData.across : cluesData.down
    
    for (const clue of otherWords) {
      if (!this.isClueWordComplete(clue, gridData)) {
        const firstEmptyPos = this.getFirstEmptyPosition(clue, gridData)
        if (firstEmptyPos) {
          console.log(`Found unfilled word in other direction: ${clue.number} ${clue.direction} at (${firstEmptyPos.row}, ${firstEmptyPos.col})`)
          return {
            row: firstEmptyPos.row,
            col: firstEmptyPos.col,
            direction: otherDirection
          }
        }
      }
    }

    console.log('No unfilled words found anywhere')
    return null
  }

  // Move to previous unfilled word
  moveToPreviousUnfilledWord(cluesData, gridData, currentDirection, currentRow, currentCol) {
    if (!cluesData) return null

    const words = currentDirection === 'across' ? cluesData.across : cluesData.down
    
    // Find the current clue to know where we are
    const currentClue = this.getCurrentClueFromPosition(currentRow, currentCol, cluesData, currentDirection)
    let foundCurrent = false
    let lastUnfilledWord = null
    
    // Go through words in reverse order to find the previous unfilled word
    for (let i = words.length - 1; i >= 0; i--) {
      const clue = words[i]
      
      // If this is our current clue, stop searching (we want the previous one)
      if (currentClue && clue.number === currentClue.number && clue.direction === currentClue.direction) {
        foundCurrent = true
        if (lastUnfilledWord) {
          return lastUnfilledWord
        }
        break
      }
      
      // Check if this word is unfilled
      if (!this.isClueWordComplete(clue, gridData)) {
        const firstEmptyPos = this.getFirstEmptyPosition(clue, gridData)
        if (firstEmptyPos) {
          lastUnfilledWord = {
            row: firstEmptyPos.row,
            col: firstEmptyPos.col,
            direction: currentDirection
          }
        }
      }
    }
    
    // If we didn't find current clue or no previous unfilled word, look in reverse order from end
    if (!foundCurrent || !lastUnfilledWord) {
      for (let i = words.length - 1; i >= 0; i--) {
        const clue = words[i]
        if (!this.isClueWordComplete(clue, gridData)) {
          const firstEmptyPos = this.getFirstEmptyPosition(clue, gridData)
          if (firstEmptyPos) {
            return {
              row: firstEmptyPos.row,
              col: firstEmptyPos.col,
              direction: currentDirection
            }
          }
        }
      }
    }

    // If no unfilled words in current direction, try the other direction
    const otherDirection = currentDirection === 'across' ? 'down' : 'across'
    const otherWords = otherDirection === 'across' ? cluesData.across : cluesData.down
    
    for (let i = otherWords.length - 1; i >= 0; i--) {
      const clue = otherWords[i]
      if (!this.isClueWordComplete(clue, gridData)) {
        const firstEmptyPos = this.getFirstEmptyPosition(clue, gridData)
        if (firstEmptyPos) {
          return {
            row: firstEmptyPos.row,
            col: firstEmptyPos.col,
            direction: otherDirection
          }
        }
      }
    }

    return null
  }

  // Save cell value to server
  saveCell(row, col, value) {
    if (this.modeValue !== 'play' || !this.puzzleIdValue) return

    fetch('/crossword_game/update_cell', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        id: this.puzzleIdValue,
        row: row,
        col: col,
        value: value
      })
    })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        console.error('Failed to save cell:', data.error)
      }
    })
    .catch(error => {
      console.error('Error saving cell:', error)
    })
  }

  // Reset entire puzzle
  resetPuzzle(gridData, gridHeight, gridWidth) {
    console.log('Play mode controller: resetPuzzle called')
    if (!confirm('Are you sure you want to reset the entire puzzle? All progress will be lost.')) {
      console.log('User cancelled reset')
      return false
    }

    console.log('User confirmed reset, dispatching puzzle-reset event')
    // Dispatch event to clear all cells
    const event = new CustomEvent('puzzle-reset', {
      detail: { 
        gridData,
        message: 'Puzzle reset!',
        messageType: 'info'
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)

    // If in play mode, send a bulk reset request to the server
    if (this.modeValue === 'play' && this.puzzleIdValue) {
      console.log('Sending reset request to server')
      this.resetPuzzleOnServer()
    }

    return true
  }

  // Helper methods

  checkClueWord(clue, highlight, gridData) {
    const wordPositions = this.getWordPositions(clue)
    let isCorrect = true

    wordPositions.forEach(({row, col}, index) => {
      const currentValue = gridData[row] && gridData[row][col]
      const correctValue = clue.answer[index]
      
      if (currentValue !== correctValue) {
        isCorrect = false
        if (highlight) {
          this.highlightIncorrectCell(row, col)
        }
      }
    })

    return isCorrect
  }

  highlightIncorrectClue(clue, gridElement) {
    const wordPositions = this.getWordPositions(clue)
    
    wordPositions.forEach(({row, col}) => {
      const cell = gridElement.querySelector(`.crossword-cell[data-row="${row}"][data-col="${col}"]`)
      if (cell) {
        cell.classList.add('error')
      }
    })
  }

  highlightIncorrectCell(row, col) {
    const cell = this.element.querySelector(`.crossword-cell[data-row="${row}"][data-col="${col}"]`)
    if (cell) {
      cell.classList.add('error')
    }
  }

  getCurrentClueFromPosition(row, col, cluesData, direction = null) {
    // If direction is specified, only check clues in that direction
    if (direction) {
      const clues = cluesData[direction] || []
      for (const clue of clues) {
        const positions = this.getWordPositions(clue)
        if (positions.some(pos => pos.row === row && pos.col === col)) {
          return clue
        }
      }
      return null
    }
    
    // Check both across and down clues to find which one contains this position
    const allClues = [...cluesData.across, ...cluesData.down]
    
    for (const clue of allClues) {
      const positions = this.getWordPositions(clue)
      if (positions.some(pos => pos.row === row && pos.col === col)) {
        return clue
      }
    }
    
    return null
  }

  getLetterIndexInWord(row, col, clue) {
    const positions = this.getWordPositions(clue)
    return positions.findIndex(pos => pos.row === row && pos.col === col)
  }

  getWordPositions(clue) {
    const positions = []
    
    if (clue.direction === 'across') {
      for (let i = 0; i < clue.answer.length; i++) {
        positions.push({
          row: clue.row,
          col: clue.col + i
        })
      }
    } else {
      for (let i = 0; i < clue.answer.length; i++) {
        positions.push({
          row: clue.row + i,
          col: clue.col
        })
      }
    }
    
    return positions
  }

  isClueWordComplete(clue, gridData) {
    const positions = this.getWordPositions(clue)
    return positions.every(({row, col}) => {
      const value = gridData[row] && gridData[row][col]
      return value && value !== '#'
    })
  }

  getFirstEmptyPosition(clue, gridData) {
    const positions = this.getWordPositions(clue)
    return positions.find(({row, col}) => {
      const value = gridData[row] && gridData[row][col]
      return !value || value === '#'
    })
  }

  checkForPuzzleCompletion(cluesData, gridData) {
    const allClues = [...cluesData.across, ...cluesData.down]
    const allComplete = allClues.every(clue => this.isClueWordComplete(clue, gridData))
    
    if (allComplete) {
      this.showMessage('🎉 Puzzle completed! Congratulations!', 'success')
      
      // Dispatch completion event
      const event = new CustomEvent('puzzle-completed', {
        detail: { cluesData, gridData },
        bubbles: true
      })
      this.element.dispatchEvent(event)
    }
  }

  showMessage(text, type) {
    // Dispatch event to show message
    const event = new CustomEvent('show-message', {
      detail: { text, type },
      bubbles: true
    })
    this.element.dispatchEvent(event)
  }

  resetPuzzleOnServer() {
    console.log('Sending PATCH request to reset puzzle on server')
    fetch('/crossword_game/reset_puzzle', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        id: this.puzzleIdValue
      })
    })
    .then(response => {
      console.log('Reset puzzle response status:', response.status)
      return response.json()
    })
    .then(data => {
      console.log('Reset puzzle response data:', data)
      if (!data.success) {
        console.error('Failed to reset puzzle on server:', data.error)
      }
    })
    .catch(error => {
      console.error('Error resetting puzzle on server:', error)
    })
  }
}
