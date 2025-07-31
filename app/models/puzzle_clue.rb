class PuzzleClue < ApplicationRecord
  belongs_to :puzzle
  belongs_to :clue

  validates :number, presence: true, numericality: { greater_than: 0 }
  validates :direction, presence: true, inclusion: { in: %w[across down] }
  validates :puzzle_id, uniqueness: { scope: [ :number, :direction ], message: "already has a clue for this number and direction" }
end
