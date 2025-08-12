class AddDateUsedToClue < ActiveRecord::Migration[8.0]
  def change
    add_column :clues, :date_used, :date
  end
end
