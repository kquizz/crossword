class Puzzle < ApplicationRecord
  # Associations
  has_many :puzzle_clues, dependent: :destroy
  has_many :clues, through: :puzzle_clues

  # Enums
  enum :difficulty, { easy: 0, medium: 1, hard: 2, expert: 3 }

  # Validations
  validates :title, presence: true
  validates :width, :height, presence: true, numericality: { greater_than: 0 }
  validates :difficulty, presence: true

  # JSON serialization for grid data
  def solution_grid
    return [] if self[:solution_grid].blank?
    data = self[:solution_grid]
    # Handle double-encoded JSON
    data = JSON.parse(data) if data.is_a?(String) && data.start_with?('"')
    data.is_a?(String) ? JSON.parse(data) : data
  end

  def solution_grid=(grid)
    self[:solution_grid] = grid.is_a?(String) ? grid : grid.to_json
  end

  def blank_grid
    return [] if self[:blank_grid].blank?
    data = self[:blank_grid]
    # Handle double-encoded JSON
    data = JSON.parse(data) if data.is_a?(String) && data.start_with?('"')
    data.is_a?(String) ? JSON.parse(data) : data
  end

  def blank_grid=(grid)
    self[:blank_grid] = grid.is_a?(String) ? grid : grid.to_json
  end

  # Helper methods
  def dimensions
    "#{width}x#{height}"
  end

  def total_squares
    width * height
  end

  def playable_squares
    return 0 if blank_grid.empty?

    blank_grid.flatten.count { |cell| cell != "#" }
  end

  def completed?
    # Add logic later for checking if puzzle is solved
    false
  end

  # Calculate crossword numbering for clues
  def calculate_numbering
    return {} if solution_grid.empty?

    # Use the helper method from CrosswordGameHelper
    helper = Object.new.extend(CrosswordGameHelper)
    helper.calculate_grid_numbering(solution_grid)
  end

  # Grid method for interactive UI - returns blank grid for playing, solution grid for editing
  def grid(mode = "play")
    case mode
    when "create", "edit"
      grid_data = solution_grid
      grid_data.empty? ? generate_empty_grid : grid_data
    else # 'play' mode
      grid_data = blank_grid
      grid_data.empty? ? generate_empty_grid : grid_data
    end
  end

  def grid=(new_grid)
    self.solution_grid = new_grid
    # Set dimensions based on grid size
    self.height = new_grid.length
    self.width = new_grid.first&.length || 0
    # Generate blank grid from solution (replace letters with nil, keep blocks)
    self.blank_grid = new_grid.map do |row|
      row.map { |cell| cell == "#" ? "#" : nil }
    end
  end

  private

    def generate_empty_grid
      w = width || 15
      h = height || 15
      Array.new(h) { Array.new(w) { nil } }
    end

    # Scope for published puzzles
    scope :published, -> { where(published: true) }
    scope :by_difficulty, ->(diff) { where(difficulty: diff) }
end
