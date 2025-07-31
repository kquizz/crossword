class Clue < ApplicationRecord
  # Associations
  has_many :puzzle_clues, dependent: :destroy
  has_many :puzzles, through: :puzzle_clues

  # Validations
  validates :clue_text, presence: true
  validates :answer, presence: true
end
