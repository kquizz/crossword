module CrosswordGameHelper
  def difficulty_color(difficulty)
    case difficulty&.to_s
    when "easy"
      "success"
    when "medium"
      "warning"
    when "hard"
      "danger"
    when "expert"
      "dark"
    else
      "secondary"
    end
  end

  def calculate_grid_numbering(grid)
    GridNumberingService.calculate(grid)
  end

  private

    # Keep these helper methods for backward compatibility if needed elsewhere
    def starts_across_word?(grid, row, col, width)
      # Must not be a blocked cell
      return false if grid[row][col] == "#" || grid[row][col].nil?

      # Must be at left edge OR previous cell is blocked
      left_is_blocked = col == 0 || grid[row][col - 1] == "#" || grid[row][col - 1].nil?

      # Must have at least one more cell to the right that's not blocked
      right_exists = col < width - 1 && grid[row][col + 1] != "#" && !grid[row][col + 1].nil?

      left_is_blocked && right_exists
    end

    def starts_down_word?(grid, row, col, height)
      # Must not be a blocked cell
      return false if grid[row][col] == "#" || grid[row][col].nil?

      # Must be at top edge OR previous cell is blocked
      top_is_blocked = row == 0 || grid[row - 1][col] == "#" || grid[row - 1][col].nil?

      # Must have at least one more cell below that's not blocked
      bottom_exists = row < height - 1 && grid[row + 1][col] != "#" && !grid[row + 1][col].nil?

      top_is_blocked && bottom_exists
    end
end
