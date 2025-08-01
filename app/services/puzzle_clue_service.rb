class PuzzleClueService
  def self.load_clues_for_puzzle(puzzle)
    new(puzzle).load_clues
  end

  def initialize(puzzle)
    @puzzle = puzzle
  end

  def load_clues
    clues = { across: [], down: [] }

    # Return empty clues if puzzle is not persisted or has no solution grid
    return clues unless @puzzle.persisted? && @puzzle.solution_grid.present?

    # Get grid numbering to find clue positions
    grid = @puzzle.solution_grid
    numbering = GridNumberingService.calculate(grid)

    @puzzle.puzzle_clues.includes(:clue).order(:number).each do |puzzle_clue|
      # Find the position of this clue number in the grid
      position = find_clue_position(numbering, puzzle_clue.number)
      next unless position

      clue_data = {
        number: puzzle_clue.number,
        clue: puzzle_clue.clue.clue_text,
        answer: puzzle_clue.clue.answer,
        direction: puzzle_clue.direction,
        row: position[:row],
        col: position[:col]
      }

      if puzzle_clue.direction == "across"
        clues[:across] << clue_data
      else
        clues[:down] << clue_data
      end
    end

    clues
  end

  private

    def find_clue_position(numbering, clue_number)
      numbering.each do |position, number|
        if number == clue_number
          return { row: position[0], col: position[1] }
        end
      end
      nil
    end
end
