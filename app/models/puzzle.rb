class Puzzle < ApplicationRecord
  # Enums
  enum :difficulty, { easy: 0, medium: 1, hard: 2 }

  # Validations
  validates :title, presence: true
  validates :width, :height, presence: true, numericality: { greater_than: 0 }
  validates :difficulty, presence: true

  # JSON serialization for grid data
  def solution_grid
    return [] if self[:solution_grid].blank?
    JSON.parse(self[:solution_grid])
  end

  def solution_grid=(grid)
    self[:solution_grid] = grid.to_json
  end

  def blank_grid
    return [] if self[:blank_grid].blank?
    JSON.parse(self[:blank_grid])
  end

  def blank_grid=(grid)
    self[:blank_grid] = grid.to_json
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

    blank_grid.flatten.count { |cell| cell != "*" }
  end

  def completed?
    # Add logic later for checking if puzzle is solved
    false
  end

  # Scope for published puzzles
  scope :published, -> { where(published: true) }
  scope :by_difficulty, ->(diff) { where(difficulty: diff) }
end
