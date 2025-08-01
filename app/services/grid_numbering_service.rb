class GridNumberingService
  # Canonical implementation of crossword grid numbering
  # This replaces duplicate logic in CrosswordGameHelper and JavaScript

  def self.calculate(grid)
    new(grid).calculate
  end

  def initialize(grid)
    @grid = grid
    return if @grid.nil? || @grid.empty?

    @height = @grid.length
    @width = @grid.first&.length || 0
  end

  def calculate
    return {} if @grid.nil? || @grid.empty?

    numbering = {}
    current_number = 1

    @grid.each_with_index do |row, row_index|
      row.each_with_index do |cell, col_index|
        next if blocked_cell?(cell)

        should_number = starts_across_word?(row_index, col_index) ||
                       starts_down_word?(row_index, col_index)

        if should_number
          numbering[[ row_index, col_index ]] = current_number
          current_number += 1
        end
      end
    end

    numbering
  end

  private

    def blocked_cell?(cell)
      cell == "#" || cell.nil?
    end

    def starts_across_word?(row, col)
      # Must not be a blocked cell
      return false if blocked_cell?(@grid[row][col])

      # Must be at left edge OR previous cell is blocked
      left_is_blocked = col == 0 || blocked_cell?(@grid[row][col - 1])

      # Must have at least one more cell to the right that's not blocked
      right_exists = col < @width - 1 && !blocked_cell?(@grid[row][col + 1])

      left_is_blocked && right_exists
    end

    def starts_down_word?(row, col)
      # Must not be a blocked cell
      return false if blocked_cell?(@grid[row][col])

      # Must be at top edge OR previous cell is blocked
      top_is_blocked = row == 0 || blocked_cell?(@grid[row - 1][col])

      # Must have at least one more cell below that's not blocked
      bottom_exists = row < @height - 1 && !blocked_cell?(@grid[row + 1][col])

      top_is_blocked && bottom_exists
    end
end
