class AddLengthToClues < ActiveRecord::Migration[7.0]
  def up
    add_column :clues, :length, :integer
    # Populate length for all existing clues
    Clue.reset_column_information
    Clue.find_each do |clue|
      clue.update_column(:length, clue.answer.length)
    end
  end

  def down
    remove_column :clues, :length
  end
end
